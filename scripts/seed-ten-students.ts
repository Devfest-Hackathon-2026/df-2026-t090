import { getAdminDb, FieldValue } from "../src/lib/firebase-admin";

/**
 * 10人の学生ユーザー（男性5名・女性5名、各々別のスキルツリーを保持）
 * およびプロジェクト参加、スキルツリー枝、チャット履歴を一括投入するスクリプト
 */

interface FullSeedStudent {
  uid: string;
  displayName: string;
  gender: "male" | "female";
  email: string;
  university: string;
  faculty: string;
  department: string;
  grade: string;
  major: string;
  mainRole: string;
  rankTitle: string;
  joinedProjectIds: string[];
  skills: Array<{
    skillId: string;
    skillName: string;
    categoryId: string;
    categoryName: string;
    status: "verified" | "pending" | "next";
    level?: number;
    score?: string;
    period?: string;
    description: string;
    evidenceType: "lecture" | "exam_qualification" | "experience" | "portfolio";
  }>;
}

const SEED_TEN_STUDENTS: FullSeedStudent[] = [
  // ─── 男性 5名 ───
  {
    uid: "student-male-tanaka",
    displayName: "田中 健太",
    gender: "male",
    email: "kenta.tanaka@student.example.com",
    university: "東京農工大学",
    faculty: "農学部",
    department: "応用生物科学科",
    grade: "学部3年",
    major: "発酵微生物学",
    mainRole: "発酵・醸造エンジニア",
    rankTitle: "二段",
    joinedProjectIds: ["demo-idea-craft-beer"],
    skills: [
      {
        skillId: "skill-microbiology",
        skillName: "微生物培養・発酵技術",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "verified",
        level: 2,
        description: "研究室で乳酸菌と清酒酵母の共培養による有機酸生成プロセスを研究。",
        evidenceType: "lecture",
      },
      {
        skillId: "skill-soil-science",
        skillName: "土壌成分分析・環境アセスメント",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "pending",
        level: 1,
        description: "大学附属農場での土壌サンプリングと窒素・リン酸の比色定量実習を完了。",
        evidenceType: "experience",
      },
      {
        skillId: "skill-bioinformatics",
        skillName: "バイオインフォマティクス・遺伝子解析",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "next",
        description: "クラフトビール酵母のゲノム変異解析を自力で行えるようになりたい。",
        evidenceType: "portfolio",
      },
    ],
  },
  {
    uid: "student-male-yamamoto",
    displayName: "山本 翔太",
    gender: "male",
    email: "shota.yamamoto@student.example.com",
    university: "東京工業大学",
    faculty: "工学院",
    department: "機械系",
    grade: "学部4年",
    major: "ロボティクス・制御工学",
    mainRole: "ハードウェア・回路設計",
    rankTitle: "三段",
    joinedProjectIds: ["demo-idea-smart-shinai"],
    skills: [
      {
        skillId: "skill-embedded-iot",
        skillName: "組み込みマイコン・IoT回路設計",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "verified",
        level: 3,
        description: "ESP32と9軸IMUを用いた高サンプリングレートなBLE送信基板を自作設計。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-fe-exam",
        skillName: "基本情報技術者試験 (FE)",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "verified",
        description: "学部2年次に合格。",
        evidenceType: "exam_qualification",
      },
      {
        skillId: "skill-ml-vision",
        skillName: "機械学習・コンピュータビジョン",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "pending",
        level: 2,
        description: "打突フォームの骨格推定AIモデルの学習パイプラインを構築中。",
        evidenceType: "portfolio",
      },
    ],
  },
  {
    uid: "student-male-watanabe",
    displayName: "渡辺 航",
    gender: "male",
    email: "watanabe.w@student.example.com",
    university: "一橋大学",
    faculty: "商学部",
    department: "商学科",
    grade: "学部3年",
    major: "マーケティング戦略・ファイナンス",
    mainRole: "ビジネスプランナー",
    rankTitle: "初段",
    joinedProjectIds: ["demo-idea-craft-beer", "demo-idea-gakushoku-recipe"],
    skills: [
      {
        skillId: "skill-ui-branding",
        skillName: "UI/UXデザイン・ブランド立ち上げ",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "verified",
        level: 2,
        description: "学生起業家選手権でクラフトビール事業計画を発表し優秀賞受賞。",
        evidenceType: "experience",
      },
      {
        skillId: "skill-toeic",
        skillName: "TOEIC L&R",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "verified",
        score: "860点",
        description: "海外ブルワリーとの英語折衝・調達交渉が可能。",
        evidenceType: "exam_qualification",
      },
    ],
  },
  {
    uid: "student-male-kobayashi",
    displayName: "小林 大地",
    gender: "male",
    email: "daichi.k@student.example.com",
    university: "慶應義塾大学",
    faculty: "看護医療学部",
    department: "看護学科",
    grade: "学部2年",
    major: "在宅福祉・リハビリ工学",
    mainRole: "医療・アクセシビリティ調査",
    rankTitle: "初段",
    joinedProjectIds: ["demo-idea-barrier-free-map"],
    skills: [
      {
        skillId: "skill-workshop-facil",
        skillName: "小学生向け理科実験ワークショップ運営",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "verified",
        period: "1.0年",
        description: "車椅子体験ワークショップを地域公民館で通算8回ファシリテーション。",
        evidenceType: "experience",
      },
      {
        skillId: "skill-microbiology",
        skillName: "微生物培養・発酵技術",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "pending",
        level: 1,
        description: "基礎看護学における病原微生物学と衛生消毒実験の単位取得。",
        evidenceType: "lecture",
      },
    ],
  },
  {
    uid: "student-male-nakamura",
    displayName: "中村 蓮",
    gender: "male",
    email: "ren.nakamura@student.example.com",
    university: "東京工業高等専門学校",
    faculty: "情報工学科",
    department: "情報システム専攻",
    grade: "高専4年",
    major: "アルゴリズム・バックエンドAPI",
    mainRole: "バックエンドエンジニア",
    rankTitle: "二段",
    joinedProjectIds: ["demo-idea-campus-map"],
    skills: [
      {
        skillId: "skill-nextjs-react",
        skillName: "Next.js / React Webアプリケーション開発",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "verified",
        level: 2,
        description: "高専プロコンでキャンパス内混雑推定APIとFastAPIサーバーを開発。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-fe-exam",
        skillName: "基本情報技術者試験 (FE)",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "verified",
        description: "高専3年次秋に合格。",
        evidenceType: "exam_qualification",
      },
      {
        skillId: "skill-embedded-iot",
        skillName: "組み込みマイコン・IoT回路設計",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "verified",
        level: 2,
        description: "教室のコンセント席に設置する光センサー連動IoTビーコンを製作。",
        evidenceType: "portfolio",
      },
    ],
  },

  // ─── 女性 5名 ───
  {
    uid: "student-female-suzuki",
    displayName: "鈴木 結愛",
    gender: "female",
    email: "yua.suzuki@student.example.com",
    university: "早稲田大学",
    faculty: "基幹理工学部",
    department: "情報通信学科",
    grade: "学部3年",
    major: "Webエンジニアリング・分散システム",
    mainRole: "フロントエンドリーダー",
    rankTitle: "三段",
    joinedProjectIds: ["demo-idea-campus-map", "demo-idea-smart-shinai"],
    skills: [
      {
        skillId: "skill-nextjs-react",
        skillName: "Next.js / React Webアプリケーション開発",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "verified",
        level: 3,
        description: "個人開発で月間1万PVの学生ポータルWebアプリを運用中。TypeScript完全対応。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-fe-exam",
        skillName: "基本情報技術者試験 (FE)",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "verified",
        description: "合格済み。",
        evidenceType: "exam_qualification",
      },
      {
        skillId: "skill-toeic",
        skillName: "TOEIC L&R",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "pending",
        score: "780点",
        description: "公式スコアシート提出中。",
        evidenceType: "exam_qualification",
      },
    ],
  },
  {
    uid: "student-female-sato",
    displayName: "佐藤 澪",
    gender: "female",
    email: "mio.sato@student.example.com",
    university: "武蔵野美術大学",
    faculty: "造形構想学部",
    department: "クリエイティブイノベーション学科",
    grade: "学部3年",
    major: "サービスデザイン・UI/UX",
    mainRole: "プロダクトデザイナー",
    rankTitle: "二段",
    joinedProjectIds: ["demo-idea-craft-beer", "demo-idea-bamboo-lamp"],
    skills: [
      {
        skillId: "skill-ui-branding",
        skillName: "UI/UXデザイン・ブランド立ち上げ",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "verified",
        level: 3,
        description: "武蔵美卒業制作優秀賞。Figma・Illustratorを用いた一貫したブランドVI設計。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-nextjs-react",
        skillName: "Next.js / React Webアプリケーション開発",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "pending",
        level: 1,
        description: "Tailwind CSSでモックアップを自力コーディング中。",
        evidenceType: "portfolio",
      },
    ],
  },
  {
    uid: "student-female-takahashi",
    displayName: "高橋 陽菜",
    gender: "female",
    email: "hina.t@student.example.com",
    university: "東京学芸大学",
    faculty: "教育学部",
    department: "初等教育教員養成課程",
    grade: "学部2年",
    major: "理科教育法・体験学習",
    mainRole: "エデュケーター",
    rankTitle: "初段",
    joinedProjectIds: ["demo-idea-science-workshop"],
    skills: [
      {
        skillId: "skill-workshop-facil",
        skillName: "小学生向け理科実験ワークショップ運営",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "verified",
        period: "1.5年",
        description: "科学館ボランティアとして子ども向け液体窒素実験を指導。",
        evidenceType: "experience",
      },
      {
        skillId: "skill-microbiology",
        skillName: "微生物培養・発酵技術",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "pending",
        level: 1,
        description: "パン酵母を使った呼吸と発酵の比較実験案を作成提出。",
        evidenceType: "lecture",
      },
    ],
  },
  {
    uid: "student-female-ito",
    displayName: "伊藤 葵",
    gender: "female",
    email: "aoi.ito@student.example.com",
    university: "京都大学",
    faculty: "理学部",
    department: "生物科学系",
    grade: "学部3年",
    major: "分子生物学・ゲノム情報科学",
    mainRole: "データサイエンティスト",
    rankTitle: "二段",
    joinedProjectIds: ["demo-idea-compost-campus"],
    skills: [
      {
        skillId: "skill-bioinformatics",
        skillName: "バイオインフォマティクス・遺伝子解析",
        categoryId: "cat-life-science",
        categoryName: "生命科学",
        status: "verified",
        level: 2,
        description: "Python / Biopythonを用いた腸内細菌叢の16S rRNAメタゲノム解析。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-ml-vision",
        skillName: "機械学習・コンピュータビジョン",
        categoryId: "cat-it-programming",
        categoryName: "情報",
        status: "verified",
        level: 2,
        description: "顕微鏡画像の菌体自動カウントモデルを構築。",
        evidenceType: "portfolio",
      },
      {
        skillId: "skill-toeic",
        skillName: "TOEIC L&R",
        categoryId: "cat-language-exams",
        categoryName: "語学・試験",
        status: "verified",
        score: "910点",
        description: "英語論文の執筆および海外共同研究の対応が可能。",
        evidenceType: "exam_qualification",
      },
    ],
  },
  {
    uid: "student-female-matsumoto",
    displayName: "松本 さくら",
    gender: "female",
    email: "sakura.m@student.example.com",
    university: "東京大学",
    faculty: "文学部",
    department: "行動文化学科",
    grade: "学部3年",
    major: "社会学・質的調査",
    mainRole: "ユーザーリサーチャー",
    rankTitle: "初段",
    joinedProjectIds: ["demo-idea-gakushoku-recipe", "demo-idea-farm-direct-dorm"],
    skills: [
      {
        skillId: "skill-ui-branding",
        skillName: "UI/UXデザイン・ブランド立ち上げ",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "verified",
        level: 2,
        description: "学食の利用者行動調査（エスノグラフィ）レポートをまとめた実績。",
        evidenceType: "experience",
      },
      {
        skillId: "skill-workshop-facil",
        skillName: "小学生向け理科実験ワークショップ運営",
        categoryId: "cat-experience",
        categoryName: "経験",
        status: "next",
        description: "大学生同士の対話型ワークショップ企画に挑戦したい。",
        evidenceType: "experience",
      },
    ],
  },
];

async function seedTenStudents() {
  console.log("🌱 10人の学生ユーザー（男性5名・女性5名）とスキルツリー枝を一括投入中...");
  const db = getAdminDb();

  for (const st of SEED_TEN_STUDENTS) {
    // 1. usersコレクションへの登録
    const userRef = db.collection("users").doc(st.uid);
    await userRef.set(
      {
        displayName: st.displayName,
        email: st.email,
        gender: st.gender,
        university: st.university,
        schoolName: st.university,
        faculty: st.faculty,
        department: st.department,
        grade: st.grade,
        major: st.major,
        mainRole: st.mainRole,
        subRoles: [],
        roles: ["student"],
        status: "active",
        joinedProjectIds: st.joinedProjectIds,
        rank: {
          title: st.rankTitle,
          breakdown: { contribution: 4, trust: 4, cooperation: 5, sharing: 4 },
          evaluationsCount: 5,
        },
        timetable: [
          { day: "mon", slot: 1, isAvailable: true },
          { day: "mon", slot: 2, isAvailable: false },
          { day: "tue", slot: 3, isAvailable: true },
          { day: "wed", slot: 4, isAvailable: true },
          { day: "thu", slot: 5, isAvailable: true },
          { day: "fri", slot: 3, isAvailable: true },
        ],
        googleCalendarSynced: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2. スキルツリー枝（user_skills）の投入
    for (const sk of st.skills) {
      const branchRef = db.collection("user_skills").doc(`${st.uid}_${sk.skillId}`);
      await branchRef.set({
        userId: st.uid,
        skillId: sk.skillId,
        skillName: sk.skillName,
        categoryId: sk.categoryId,
        categoryName: sk.categoryName,
        status: sk.status,
        level: sk.level || null,
        score: sk.score || null,
        period: sk.period || null,
        evidence: {
          evidenceType: sk.evidenceType,
          description: sk.description,
          fileUrls: ["https://example.com/demo-evidence.pdf"],
          links: ["https://github.com/example-project"],
        },
        reviewerComment: sk.status === "verified" ? "提出された実績レポートと成果物を確認し、スキル枝として認定しました。" : null,
        submittedAt: FieldValue.serverTimestamp(),
        reviewedAt: sk.status === "verified" ? FieldValue.serverTimestamp() : null,
      });
    }

    // 3. 参加プロジェクトのメンバー登録 ＆ リアルなチャット発言の投入
    for (const pId of st.joinedProjectIds) {
      const memberRef = db
        .collection("ideas")
        .doc(pId)
        .collection("members")
        .doc(st.uid);

      await memberRef.set(
        {
          userId: st.uid,
          displayName: st.displayName,
          schoolName: st.university,
          roleName: st.mainRole,
          isOwner: false,
          isFacilitator: st.uid === "student-female-suzuki", // 鈴木結愛さんを進行役設定
          participationType: "membership",
          status: "active",
          joinedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // プロジェクト内にリアルなチャット発言をシード投入
      const msgRef = db.collection("ideas").doc(pId).collection("messages").doc();
      await msgRef.set({
        roomId: "general",
        senderUid: st.uid,
        senderName: st.displayName,
        senderSchool: `${st.university} ${st.faculty}`,
        senderRole: st.mainRole,
        text: `こんにちは！${st.university}の${st.displayName}です。${st.mainRole}としてチームに参加しました。よろしくお願いします！`,
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    console.log(`  ✓ [${st.gender === "male" ? "男" : "女"}] ${st.displayName} (${st.university}) - 枝数: ${st.skills.length}件`);
  }

  // 4. 代表プロジェクト（伝統クラフトビール）に進行役からの全体連絡を投入
  const craftBeerAnnounceRef = db
    .collection("ideas")
    .doc("demo-idea-craft-beer")
    .collection("messages")
    .doc("demo-initial-announcement");

  await craftBeerAnnounceRef.set({
    roomId: "general",
    senderUid: "student-female-suzuki",
    senderName: "鈴木 結愛",
    senderSchool: "早稲田大学 基幹理工学部",
    senderRole: "進行役",
    text: "【重要全体連絡】来週金曜20時より、試作ホップの選定とラベルモックの確認ミーティングを行います。各自確認ボタンを押してください！",
    isAnnouncement: true,
    deadline: "2026-11-14",
    confirmedUserUids: ["student-male-tanaka", "student-female-sato"],
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("\n🎉 10人の学生ユーザー・スキルツリー・進行中プロジェクトへの参加データ投入が完了しました！");
}

seedTenStudents().catch((err) => {
  console.error("❌ 投入エラー:", err);
  process.exit(1);
});
