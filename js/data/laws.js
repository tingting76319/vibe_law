// Legal-RAG 法規資料庫
// 資料來源：全國法規資料庫（模擬資料）

const LAWS_DATA = {
    civil: [
        {
            id: "civil-184",
            name: "民法第184條（侵權行為）",
            category: "民法",
            chapter: "債編",
            content: "因故意或過失，不法侵害他人之權利者，負損害賠償責任。故意以侵害他人之意思，而加損害於他人者，亦同。\n\n違反保護他人之法律，致生損害於他人者，負賠償責任。但能證明其行為無過失者，不在此限。",
            lastAmended: "2023-01-01"
        },
        {
            id: "civil-193",
            name: "民法第193條（人身損害）",
            category: "民法",
            chapter: "債編",
            content: "不法侵害他人之身體、健康、名譽、自由、信用、隱私、貞操，或不法侵害其他人格法益而達於足以重傷他人之程度者，被害人雖非財產上之損害，亦得請求賠償相當之金額。\n\n前項請求權，不得讓與或繼承。但以金額賠償之請求權已依契約承諾，或已起訴者，不在此限。",
            lastAmended: "2022-06-22"
        },
        {
            id: "civil-195",
            name: "民法第195條（非財產上損害）",
            category: "民法",
            chapter: "債編",
            content: "不法侵害他人之身體、健康、名譽、自由、信用、隱私、貞操，或不法侵害其他人格法益而達於足以重傷他人之程度者，被害人雖非財產上之損害，亦得請求賠償相當之金額。\n\n其名譽被侵害者，並得請求回復名譽之適當處分。",
            lastAmended: "2022-06-22"
        },
        {
            id: "civil-1055",
            name: "民法第1055條（監護權）",
            category: "民法",
            chapter: "親屬編",
            content: "夫妻離婚者，對於未成年子女權利義務之行使或負擔，依協議由一方或雙方共同任之。未為協議或協議不成者，法院得依夫妻之一方、主管機關、社會福利機構或其他利害關係人之請求或依職權酌定之。\n\n前項協議不利於子女者，法院得依主管機關、社會福利機構或其他利害關係人之請求或依職權為子女之利益改定之。",
            lastAmended: "2020-12-30"
        },
        {
            id: "civil-1138",
            name: "民法第1138條（法定繼承人）",
            category: "民法",
            chapter: "繼承編",
            content: "遺產繼承人，除配偶外，依下列順序定之：\n一、直系血親卑親屬。\n二、父母。\n三、兄弟姐妹。\n四、祖父母。",
            lastAmended: "2020-01-15"
        },
        {
            id: "civil-1223",
            name: "民法第1223條（特留分）",
            category: "民法",
            chapter: "繼承編",
            content: "繼承人之特留分，依左列各款之規定：\n一、直系血親卑親屬為倫理上之一等親尊親屬，其特留分為其應繼分二分之一。\n二、父母為應繼分二分之一。\n三、兄弟姐妹為應繼分三分之一。\n四、祖父母為應繼分三分之一。",
            lastAmended: "2020-01-15"
        },
        {
            id: "civil-423",
            name: "民法第423條（出租人之義務）",
            category: "民法",
            chapter: "債編",
            content: "出租人應於租賃物之交付前，完成其應為之修缮，並應保持其於租賃關係存續中始終處於適於約定使用、收益之狀態。\n\n出租人為保存租賃物所為之必要行為，承租人不得拒絕。",
            lastAmended: "2021-03-10"
        },
        {
            id: "civil-429",
            name: "民法第429條（承租人之保管義務）",
            category: "民法",
            chapter: "債編",
            content: "承租人應以善良管理人之注意，保管租賃物。租賃物有生產力者，並應保持其生產力。\n\n承租人違反前項義務，致租賃物毀損、滅失或變更其性質者，應負賠償責任。但依約定之使用方法或依物之性質而定之方法為使用、收益，致有變更或毀損者，不在此限。",
            lastAmended: "2021-03-10"
        },
        {
            id: "civil-793",
            name: "民法第793條（鄰地通行權）",
            category: "民法",
            chapter: "物權編",
            content: "土地所有人不得禁止他人之無害通過，或接近、逾越其土地。\n\n前項情形，行為人應選擇對土地所有人損害最少之方法為之，並應於相當期限內通知土地所有人。",
            lastAmended: "2020-07-15"
        }
    ],
    criminal: [
        {
            id: "criminal-276",
            name: "刑法第276條（過失致死）",
            category: "刑法",
            chapter: "傷害罪",
            content: "因過失致人於死者，處二年以下有期徒刑、拘役或二千元以下罰金。\n\n從事業務之人，因業務上之過失致人於死者，處五年以下有期徒刑或拘役，得併科三千元以下罰金。",
            lastAmended: "2022-01-12"
        },
        {
            id: "criminal-284",
            name: "刑法第284條（過失傷害）",
            category: "刑法",
            chapter: "傷害罪",
            content: "因過失傷害人者，處一年以下有期徒刑、拘役或十千元以下罰金。\n\n從事業務之人，因業務上之過失傷害人者，處三年以下有期徒刑、拘役或五十千元以下罰金。\n\n第一項之罪，須告訴乃論。",
            lastAmended: "2022-01-12"
        },
        {
            id: "criminal-271",
            name: "刑法第271條（殺人罪）",
            category: "刑法",
            chapter: "殺人罪",
            content: "殺人者，處死刑、無期徒刑或十年以上有期徒刑。\n\n未遂犯之處罰之。\n\n犯前項之罪因而致被害人於死者，適用之。",
            lastAmended: "2021-06-16"
        }
    ],
    administrative: [
        {
            id: "labor-11",
            name: "勞動基準法第11條（雇主終止勞動契約）",
            category: "勞動基準法",
            chapter: "勞動契約",
            content: "非有下列情事之一者，雇主不得預告勞工終止勞動契約：\n一、歇業或轉讓時。\n二、虧損或業務緊縮時。\n三、不可抗力繼續工作在個月以上時。\n四、雇主對於該項工作上所必須之知識、技能等因素並且對其在該工作上不能勝任時。",
            lastAmended: "2023-01-18"
        },
        {
            id: "labor-17",
            name: "勞動基準法第17條（資遣費）",
            category: "勞動基準法",
            chapter: "工資",
            content: "雇主依前條終止勞動契約者，應依下列規定發給勞工資遣費：\n一、在同一雇主之事業單位繼續工作，每滿一年發給相當於一個月平均工資之資遣費。\n二、依前款計算之剩餘月數，或工作未滿一年者，按比例發給資遣費。\n三、雇主應於終止勞動契約日前三十日發出預告。",
            lastAmended: "2023-01-18"
        }
    ],
    "civil-procedure": [
        {
            id: "cpc-249",
            name: "民事訴訟法第249條（起訴要件）",
            category: "民事訴訟法",
            chapter: "第一審程序",
            content: "原告之訴，有下列各款情形之一者，法院應以裁定駁回之。但其情形可以補正者，審判長應定期間先命補正：\n一、訴訟事件不屬普通法院之管轄。二、原告或被告無當事人能力。三、原告或被告無訴訟能力。四、由訴訟代理人起訴，而其代理權有欠缺。五、起訴不合程式或不備其他要件。六、原告提起之訴，其訴訟標的為確定終局判決之效力所及。",
            lastAmended: "2022-06-22"
        }
    ]
};

// 取得法規列表
function getLawsByCategory(category) {
    return LAWS_DATA[category] || [];
}

// 搜尋法規
function searchLaws(query) {
    const keywords = query.toLowerCase().split(/\s+/);
    const results = [];
    
    Object.values(LAWS_DATA).forEach(categoryLaws => {
        categoryLaws.forEach(law => {
            const searchText = [
                law.name,
                law.content,
                law.category
            ].join(' ').toLowerCase();
            
            if (keywords.some(k => searchText.includes(k))) {
                results.push(law);
            }
        });
    });
    
    return results;
}

// 取得法規詳情
function getLawById(id) {
    for (const category of Object.values(LAWS_DATA)) {
        const law = category.find(l => l.id === id);
        if (law) return law;
    }
    return null;
}
