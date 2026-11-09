import { getAdminDb, FieldValue } from "../src/lib/firebase-admin";

/**
 * HIVE 第1段階マスターデータシードスクリプト
 * - 学校マスター（大学・高専）
 * - スキル分野（4分野: 生命科学、情報、語学・試験、経験）
 * - スキルマスター（各分野の代表スキル、レベル方式、根拠要件）
 * - 開発者アカウントへの運営（admin）権限付与
 */

const SEED_SCHOOLS = [
  { id: "school-utokyo", name: "東京大学", type: "university", prefecture: "東京都" },
  { id: "school-kyoto", name: "京都大学", type: "university", prefecture: "京都府" },
  { id: "school-titech", name: "東京工業大学", type: "university", prefecture: "東京都" },
  { id: "school-tuat", name: "東京農工大学", type: "university", prefecture: "東京都" },
  { id: "school-waseda", name: "早稲田大学", type: "university", prefecture: "東京都" },
  { id: "school-keio", name: "慶應義塾大学", type: "university", prefecture: "東京都" },
  { id: "school-hitotsubashi", name: "一橋大学", type: "university", prefecture: "東京都" },
  { id: "school-gakugei", name: "東京学芸大学", type: "university", prefecture: "東京都" },
  { id: "school-musabi", name: "武蔵野美術大学", type: "university", prefecture: "東京都" },
  { id: "school-osaka", name: "大阪大学", type: "university", prefecture: "大阪府" },
  { id: "school-nagoya", name: "名古屋大学", type: "university", prefecture: "愛知県" },
  { id: "school-tohoku", name: "東北大学", type: "university", prefecture: "宮城県" },
  { id: "school-kyutech", name: "九州工業大学", type: "university", prefecture: "福岡県" },
  { id: "school-tokyo-ct", name: "東京工業高等専門学校", type: "kosen", prefecture: "東京都" },
  { id: "school-suzuka-ct", name: "鈴鹿工業高等専門学校", type: "kosen", prefecture: "三重県" },
  { id: "school-akashi-ct", name: "明石工業高等専門学校", type: "kosen", prefecture: "兵庫県" },
];

const SEED_CATEGORIES = [
  { id: "cat-life-science", name: "生命科学", order: 1 },
  { id: "cat-it-programming", name: "情報", order: 2 },
  { id: "cat-language-exams", name: "語学・試験", order: 3 },
  { id: "cat-experience", name: "経験", order: 4 },
];

const SEED_SKILLS = [
  // 生命科学
  {
    id: "skill-microbiology",
    categoryId: "cat-life-science",
    categoryName: "生命科学",
    name: "微生物培養・発酵技術",
    aliases: ["発酵工学", "菌体培養", "バイオリアクター"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "実験レポート、研究室所属証明、または指導教員の確認書",
    status: "active",
  },
  {
    id: "skill-bioinformatics",
    categoryId: "cat-life-science",
    categoryName: "生命科学",
    name: "バイオインフォマティクス・遺伝子解析",
    aliases: ["ゲノム解析", "BLAST", "NGS解析"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "解析パイプラインのソースコード（GitHub等）または論文・学会発表予稿",
    status: "active",
  },
  {
    id: "skill-soil-science",
    categoryId: "cat-life-science",
    categoryName: "生命科学",
    name: "土壌成分分析・環境アセスメント",
    aliases: ["土壌肥沃度", "水質検査", "成分分析"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "実習レポートまたは測定データの解析記録",
    status: "active",
  },

  // 情報
  {
    id: "skill-nextjs-react",
    categoryId: "cat-it-programming",
    categoryName: "情報",
    name: "Next.js / React Webアプリケーション開発",
    aliases: ["フロントエンド", "TypeScript", "React"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "公開リポジトリ（GitHub）、制作したWebサービスのURL",
    status: "active",
  },
  {
    id: "skill-embedded-iot",
    categoryId: "cat-it-programming",
    categoryName: "情報",
    name: "組み込みマイコン・IoT回路設計",
    aliases: ["Arduino", "Raspberry Pi", "ESP32", "電子工作"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "回路図、動作動画、QiitaやZennの解説記事",
    status: "active",
  },
  {
    id: "skill-ml-vision",
    categoryId: "cat-it-programming",
    categoryName: "情報",
    name: "機械学習・コンピュータビジョン",
    aliases: ["Python", "PyTorch", "OpenCV", "画像認識"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "モデル検証用Jupyter NotebookまたはGitHubリポジトリ",
    status: "active",
  },

  // 語学・試験
  {
    id: "skill-toeic",
    categoryId: "cat-language-exams",
    categoryName: "語学・試験",
    name: "TOEIC L&R",
    aliases: ["英語", "TOEICスコア"],
    levelType: "score",
    hasLevels: false,
    requiredEvidencePrompt: "公式認定証（スコアシート）の画像またはPDF",
    status: "active",
  },
  {
    id: "skill-fe-exam",
    categoryId: "cat-language-exams",
    categoryName: "語学・試験",
    name: "基本情報技術者試験 (FE)",
    aliases: ["IPA", "情報処理技術者"],
    levelType: "none",
    hasLevels: false,
    requiredEvidencePrompt: "合格証書の画像またはPDF",
    status: "active",
  },

  // 経験
  {
    id: "skill-workshop-facil",
    categoryId: "cat-experience",
    categoryName: "経験",
    name: "小学生向け理科実験ワークショップ運営",
    aliases: ["出張実験", "ファシリテーション", "教育ボランティア"],
    levelType: "period",
    hasLevels: false,
    requiredEvidencePrompt: "イベント実施報告書、企画書、写真、主催団体の証明",
    status: "active",
  },
  {
    id: "skill-ui-branding",
    categoryId: "cat-experience",
    categoryName: "経験",
    name: "UI/UXデザイン・ブランド立ち上げ",
    aliases: ["Figma", "ロゴデザイン", "ブランディング"],
    levelType: "level",
    hasLevels: true,
    requiredEvidencePrompt: "ポートフォリオサイト、Figmaモックアップ、制作実績",
    status: "active",
  },
];

async function seedMaster() {
  console.log("🌱 HIVE マスターデータの投入を開始します...");
  const db = getAdminDb();

  // 1. 学校マスター
  console.log(`🏫 学校マスター（${SEED_SCHOOLS.length}校）を投入中...`);
  for (const school of SEED_SCHOOLS) {
    const schoolRef = db.collection("schools_master").doc(school.id);
    await schoolRef.set(
      {
        name: school.name,
        type: school.type,
        prefecture: school.prefecture,
        registeredUsersCount: 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`  ✓ ${school.name} (${school.prefecture})`);
  }

  // 2. スキル分野
  console.log(`\n📂 スキル分野（${SEED_CATEGORIES.length}分野）を投入中...`);
  for (const cat of SEED_CATEGORIES) {
    const catRef = db.collection("skills_categories").doc(cat.id);
    await catRef.set(
      {
        name: cat.name,
        order: cat.order,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`  ✓ 分野: ${cat.name}`);
  }

  // 3. スキルマスター
  console.log(`\n🌿 スキルマスター（${SEED_SKILLS.length}件）を投入中...`);
  for (const skill of SEED_SKILLS) {
    const skillRef = db.collection("skills_master").doc(skill.id);
    await skillRef.set(
      {
        categoryId: skill.categoryId,
        categoryName: skill.categoryName,
        name: skill.name,
        aliases: skill.aliases,
        levelType: skill.levelType,
        hasLevels: skill.hasLevels,
        requiredEvidencePrompt: skill.requiredEvidencePrompt,
        status: skill.status,
        holdersCount: 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`  ✓ スキル: [${skill.categoryName}] ${skill.name}`);
  }

  // 4. 初期運営者アカウントの設定（開発者・運営ユーザー）
  console.log("\n🛡️ 運営者権限（Admin）の設定中...");
  const adminEmail = "stromain.hq@gmail.com";
  const usersSnapshot = await db.collection("users").get();
  let adminAssigned = false;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    if (data.email === adminEmail || doc.id.includes("stromain") || data.displayName?.includes("stromain")) {
      await doc.ref.set(
        {
          roles: ["student", "admin"],
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`  ✓ 既存ユーザーに運営権限を付与: ${data.displayName || doc.id} (${doc.id})`);
      adminAssigned = true;
    }
  }

  if (!adminAssigned) {
    // まだユーザーが作成されていない場合のプレースホルダー（ログイン時に即時admin昇格されるよう専用UIDまたはメールアドレスで準備）
    const placeholderAdminRef = db.collection("users").doc("admin-master");
    await placeholderAdminRef.set(
      {
        email: adminEmail,
        displayName: "運営管理者 (HIVE本部)",
        roles: ["student", "admin"],
        status: "active",
        schoolId: "school-tuat",
        schoolName: "東京農工大学",
        faculty: "本部",
        department: "運営事務局",
        grade: "スタッフ",
        major: "コミュニティ運営",
        mainRole: "統括ディレクター",
        subRoles: [],
        rank: {
          title: "師範",
          breakdown: { contribution: 5, trust: 5, cooperation: 5, sharing: 5 },
          evaluationsCount: 20,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`  ✓ 運営者マスターアカウント（${adminEmail}）を作成しました。`);
  }

  console.log("\n🎉 HIVE マスターデータ投入が完了しました！");
}

seedMaster().catch((err) => {
  console.error("❌ マスター投入エラー:", err);
  process.exit(1);
});
