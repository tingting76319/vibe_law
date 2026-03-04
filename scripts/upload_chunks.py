#!/usr/bin/env python3
"""
Split a local month folder into smaller ZIP chunks and upload them to /api/upload/upload.

Usage:
  python3 scripts/upload_chunks.py \
    --folder "/path/to/202412" \
    --base-url "https://vibe-law.zeabur.app" \
    --chunk-size 2000
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import tempfile
import time
import zipfile
from typing import List
from urllib import request, error


def list_json_files(folder: pathlib.Path) -> List[pathlib.Path]:
    return sorted([p for p in folder.rglob("*.json") if p.is_file()])


def make_zip(files: List[pathlib.Path], root: pathlib.Path, out_path: pathlib.Path) -> None:
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            zf.write(file_path, arcname=str(file_path.relative_to(root)))


def post_multipart(url: str, file_path: pathlib.Path, retries: int = 3) -> dict:
    boundary = "----UploadBoundary7MA4YWxkTrZu0gW"
    file_name = file_path.name
    body_start = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'
        "Content-Type: application/zip\r\n\r\n"
    ).encode("utf-8")
    body_end = f"\r\n--{boundary}--\r\n".encode("utf-8")
    data = body_start + file_path.read_bytes() + body_end

    for attempt in range(1, retries + 1):
        req = request.Request(
            url=url,
            method="POST",
            data=data,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        try:
            with request.urlopen(req, timeout=180) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                payload = json.loads(raw)
                payload["_http_status"] = resp.status
                return payload
        except Exception as exc:  # noqa: BLE001
            if attempt == retries:
                raise RuntimeError(f"upload failed after {retries} attempts: {exc}") from exc
            time.sleep(5)

    raise RuntimeError("unreachable")


def poll_job(status_url: str, timeout_s: int = 3600) -> dict:
    start = time.time()
    bad_count = 0
    while time.time() - start < timeout_s:
        try:
            with request.urlopen(status_url, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8", errors="replace"))
                status = payload.get("status")
                if status in {"completed", "failed"}:
                    return payload
                bad_count = 0
        except error.HTTPError as exc:
            # job not found / gateway transient
            if exc.code in {404, 502, 503, 504}:
                bad_count += 1
            else:
                raise
        except Exception:  # noqa: BLE001
            bad_count += 1

        if bad_count >= 24:
            raise RuntimeError("job status unavailable for too long")
        time.sleep(5)

    raise TimeoutError("job poll timeout")


def chunks(items: List[pathlib.Path], size: int) -> List[List[pathlib.Path]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", required=True, help="month folder path (contains json + subfolders)")
    parser.add_argument("--base-url", required=True, help="api base url, e.g. https://vibe-law.zeabur.app")
    parser.add_argument("--chunk-size", type=int, default=2000, help="json files per zip chunk")
    args = parser.parse_args()

    folder = pathlib.Path(args.folder).expanduser().resolve()
    if not folder.exists():
        print(f"[ERROR] folder not found: {folder}")
        return 1

    files = list_json_files(folder)
    if not files:
        print("[ERROR] no json files found")
        return 1

    groups = chunks(files, args.chunk_size)
    upload_url = args.base_url.rstrip("/") + "/api/upload/upload"

    print(f"[INFO] folder={folder}")
    print(f"[INFO] files={len(files)} chunks={len(groups)} chunk_size={args.chunk_size}")

    for idx, group in enumerate(groups, start=1):
        with tempfile.NamedTemporaryFile(prefix=f"{folder.name}-{idx:03d}-", suffix=".zip", delete=False) as tf:
            zip_path = pathlib.Path(tf.name)
        try:
            make_zip(group, folder, zip_path)
            print(f"[CHUNK {idx}/{len(groups)}] zip={zip_path.name} files={len(group)}")

            payload = post_multipart(upload_url, zip_path, retries=3)
            job_id = payload.get("jobId")
            if not job_id:
                raise RuntimeError(f"upload response missing jobId: {payload}")
            print(f"[CHUNK {idx}] jobId={job_id}")

            job_payload = poll_job(args.base_url.rstrip("/") + f"/api/upload/jobs/{job_id}")
            print(
                f"[CHUNK {idx}] status={job_payload.get('status')} "
                f"imported={job_payload.get('imported')} errors={job_payload.get('errors')}"
            )
            if job_payload.get("status") != "completed":
                raise RuntimeError(f"job failed: {job_payload}")
            time.sleep(10)
        finally:
            try:
                zip_path.unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                pass

    print("[DONE] all chunks completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
