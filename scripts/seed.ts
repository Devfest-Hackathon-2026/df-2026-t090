import { getAdminDb, FieldValue } from "../src/lib/firebase-admin";

/**
 * デモ用シードデータ投入スクリプト
 * 異なる専門分野の学生が協力し合うリアルな10件の公開プロジェクトと、
 * 投稿者およびスキル登録学生のデータをFirestoreに投入します。
 */

interface SeedUser {
  uid: string;
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
  skills: string;
  motivation: string;
}

interface SeedRole {
  name: string;
  reason: string;
  skills: string[];
}

interface SeedSuggestion {
  studentId: string;
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
  skills: string;
  matchedRole: string;
  reason: string;
}

interface SeedIdea {
  id: string;
  ownerUid: string;
  title: string;
  goal: string;
  fields: string[];
  roles: SeedRole[];
  firstSteps: string[];
  rawText: string;
  aiSuggestions: SeedSuggestion[];
}

const SEED_USERS: SeedUser[] = [
  {
    uid: "demo-user-agri-tanaka",
    displayName: "田中 健太",
    university: "東京農工大学",
    faculty: "農学部",
    department: "応用生物科学科",
    major: "発酵微生物学",
    skills: "微生物培養、発酵プロセス管理、土壌成分分析、酵母スクリーニング",
    motivation: "研究室で培った発酵技術を活かして、地域の特産品づくりや循環型農業に関わりたいです！",
  },
  {
    uid: "demo-user-eng-yamamoto",
    displayName: "山本 翔太",
    university: "東京工業大学",
    faculty: "工学院",
    department: "機械系",
    major: "ロボティクス・制御工学",
    skills: "Arduino/Raspberry Pi回路設計、Fusion 360による3Dモデリング、Python、センサー制御",
    motivation: "身の回りのスポーツや道具をスマート化するハードウェア開発に情熱を持っています。",
  },
  {
    uid: "demo-user-info-suzuki",
    displayName: "鈴木 結愛",
    university: "早稲田大学",
    faculty: "基幹理工学部",
    department: "情報通信学科",
    major: "Webエンジニアリング",
    skills: "Next.js、React、TypeScript、Tailwind CSS、Firebase、REST API設計",
    motivation: "他分野の面白いアイデアをWebやスマホアプリの形にして世に出すのが好きです！",
  },
  {
    uid: "demo-user-des-sato",
    displayName: "佐藤 澪",
    university: "武蔵野美術大学",
    faculty: "造形構想学部",
    department: "クリエイティブイノベーション学科",
    major: "UI/UX・ブランディング",
    skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
    motivation: "技術や社会課題をわかりやすく親しみやすいデザインで伝えるチームに参加したいです。",
  },
  {
    uid: "demo-user-biz-watanabe",
    displayName: "渡辺 航",
    university: "一橋大学",
    faculty: "商学部",
    department: "商学科",
    major: "マーケティング戦略",
    skills: "事業計画書作成、SNSマーケティング企画、提携交渉、財務モデリング、顧客ヒアリング",
    motivation: "学生主導のプロジェクトをしっかりマネタイズや持続可能な仕組みに育てる参謀になりたいです。",
  },
  {
    uid: "demo-user-edu-takahashi",
    displayName: "高橋 陽菜",
    university: "東京学芸大学",
    faculty: "教育学部",
    department: "初等教育教員養成課程",
    major: "理科教育法",
    skills: "小学生向け教材開発、ワークショップ運営、ファシリテーション、授業指導案作成",
    motivation: "子どもたちが科学の面白さに目を輝かせる出張体験をつくりたいです！",
  },
  {
    uid: "demo-user-med-kobayashi",
    displayName: "小林 大地",
    university: "慶應義塾大学",
    faculty: "看護医療学部",
    department: "看護学科",
    major: "リハビリテーション・在宅福祉",
    skills: "理学療法基礎、当事者ヒアリング、バリアフリー調査、福祉用具選定",
    motivation: "医療や福祉の知識をITやデザインと掛け合わせて、誰でも生きやすい社会をつくりたい。",
  },
];

const SEED_IDEAS: SeedIdea[] = [
  {
    id: "demo-idea-craft-beer",
    ownerUid: "demo-user-agri-tanaka",
    title: "伝統野菜の復活とマイクロブルワリーによる地域ブランドクラフトビール開発",
    goal: "耕作放棄地で栽培した地域の伝統ホップと野菜を副原料にし、学生発祥のクラフトビールブランドとして商品化する。",
    fields: ["農業・生物", "ビジネス"],
    roles: [
      {
        name: "醸造・発酵技術担当",
        reason: "副原料の糖度や酵母の相性を実験し、安定した香味を生み出すため",
        skills: ["微生物発酵", "食品化学", "衛生管理"],
      },
      {
        name: "パッケージ・ラベルデザイナー",
        reason: "若者や観光客の目を引く洗練された缶・瓶ラベルとWEBサイトを制作するため",
        skills: ["Figma", "Illustrator", "ブランディング"],
      },
      {
        name: "販路開拓・クラウドファンディング企画",
        reason: "地元飲食店との提携やクラファンを通じた事前ファンづくりを統括するため",
        skills: ["営業交渉", "SNSマーケティング", "事業計画"],
      },
    ],
    firstSteps: [
      "伝統ホップの小規模試験栽培の開始",
      "提携可能な小規模ブルワリー（OEM先）へのヒアリング",
      "ブランドコンセプトシートとモックラベルの作成",
    ],
    rawText: "大学の農場で地域の伝統的な野菜やホップを復活させています。これを活かした学生発のオリジナルクラフトビールを作りたいです！美味しいビールを作る醸造知識はもちろん、カッコいいラベルをデザインしてくれる人や、お店に置いてもらう交渉が得意なビジネス系の人と一緒にやりたいです！",
    aiSuggestions: [
      {
        studentId: "demo-user-des-sato",
        displayName: "佐藤 澪",
        university: "武蔵野美術大学",
        faculty: "造形構想学部",
        department: "クリエイティブイノベーション学科",
        major: "UI/UX・ブランディング",
        skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
        matchedRole: "パッケージ・ラベルデザイナー",
        reason: "武蔵美でブランディングやパッケージデザインを専攻しており、地域ブランドの魅力を若者に届けるデザイン制作に直結します。",
      },
      {
        studentId: "demo-user-biz-watanabe",
        displayName: "渡辺 航",
        university: "一橋大学",
        faculty: "商学部",
        department: "商学科",
        major: "マーケティング戦略",
        skills: "事業計画書作成、SNSマーケティング企画、提携交渉、財務モデリング、顧客ヒアリング",
        matchedRole: "販路開拓・クラウドファンディング企画",
        reason: "商学部でマーケティング戦略と事業計画を学び、地元飲食店への提携交渉や事前ファン開拓を主導できる実務スキルを有しています。",
      },
    ],
  },
  {
    id: "demo-idea-smart-shinai",
    ownerUid: "demo-user-eng-yamamoto",
    title: "小型生体・角速度センサー内蔵スマート竹刀による剣道の打突フォーム可視化システム",
    goal: "竹刀の柄部分に超小型9軸センサーを組み込み、打突の鋭さや刃筋のブレをスマホでミリ秒単位で解析・指導できる練習デバイスを作る。",
    fields: ["工学・ものづくり", "情報・プログラミング"],
    roles: [
      {
        name: "小型ハードウェア回路設計エンジニア",
        reason: "竹刀の激しい衝撃に耐え、重量バランスを崩さない超小型センサー基板を設計するため",
        skills: ["基板設計", "マイコン制御", "耐衝撃設計"],
      },
      {
        name: "モバイルアプリ開発エンジニア",
        reason: "Bluetooth通信でセンサーデータを受信し、打突軌道を3Dグラフィックで可視化するため",
        skills: ["React Native", "Flutter", "Bluetooth通信"],
      },
      {
        name: "剣道有段者・スポーツ科学アナリスト",
        reason: "打突の良し悪しを定義する基準データの収集と実証実験を主導するため",
        skills: ["剣道経験（三段以上）", "スポーツバイオメカニクス", "コーチング"],
      },
    ],
    firstSteps: [
      "プロトタイプ用9軸センサーとBLEマイコンの竹刀柄への装着テスト",
      "打突時の角速度・加速度ログデータの波形解析",
      "スマホ表示用の簡易グラフ画面のプロトタイプ制作",
    ],
    rawText: "剣道部の練習で、感覚に頼りがちな『手の内の冴え』や『刃筋の正しさ』をデータで可視化したいと考えました。竹刀の柄に超小型の加速度・ジャイロセンサーを埋め込み、打突の瞬間をスマホで分析できるスマート竹刀を作ります！基板を小さく作れる人、スマホアプリを作れる人を募集しています！",
    aiSuggestions: [
      {
        studentId: "demo-user-info-suzuki",
        displayName: "鈴木 結愛",
        university: "早稲田大学",
        faculty: "基幹理工学部",
        department: "情報通信学科",
        major: "Webエンジニアリング",
        skills: "Next.js、React、TypeScript、Tailwind CSS、Firebase、REST API設計",
        matchedRole: "モバイルアプリ開発エンジニア",
        reason: "フロントエンド開発・リアルタイムデータ連携の実装経験が豊富で、センサーから届く高速な時系列データのグラフ化・可視化を素早く構築できます。",
      },
    ],
  },
  {
    id: "demo-idea-campus-map",
    ownerUid: "demo-user-info-suzuki",
    title: "キャンパス内の空き教室と充電コンセント席をリアルタイム共有する学生マップ",
    goal: "授業の空きコマに『静かに自習できる場所』『充電できるコンセント席』を学生同士のリアルタイム報告でマップ上に可視化する学内インフラアプリ。",
    fields: ["情報・プログラミング", "デザイン"],
    roles: [
      {
        name: "フロントエンド・モバイル開発",
        reason: "現在地連動マップの快適な描画とリアルタイム混雑度更新を実装するため",
        skills: ["Next.js", "TypeScript", "Google Maps API", "PWA"],
      },
      {
        name: "UI/UXデザイナー",
        reason: "急いでいる休み時間でも1タップで空き状況が直感的にわかるUIを設計するため",
        skills: ["Figma", "UI設計", "モバイルファーストデザイン"],
      },
      {
        name: "学内広報・アンバサダーリーダー",
        reason: "初速で学生数百人に使ってもらい、スポット情報が集まるコミュニティを形成するため",
        skills: ["学内SNS運用", "口コミマーケティング", "学生団体連携"],
      },
    ],
    firstSteps: [
      "主要キャンパスの教室・フリースペースのコンセント位置調査（50箇所）",
      "FigmaでのプロトタイプUI作成と学生10名へのデモ検証",
      "Firebaseを用いた位置情報ピン留め機能のPoC開発",
    ],
    rawText: "テスト期間や空きコマに、空いている教室やコンセントがある席を探してキャンパスを歩き回る無駄な時間をなくしたいです！Googleマップ上に学生同士で『ここ今空いてるよ』『充電できる席あるよ』とピンを立てられる超軽量Webアプリを作りたいです。UIをオシャレに作ってくれるデザイナーさんを特に探しています！",
    aiSuggestions: [
      {
        studentId: "demo-user-des-sato",
        displayName: "佐藤 澪",
        university: "武蔵野美術大学",
        faculty: "造形構想学部",
        department: "クリエイティブイノベーション学科",
        major: "UI/UX・ブランディング",
        skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
        matchedRole: "UI/UXデザイナー",
        reason: "武蔵美でUI/UXデザインを専攻しており、Figmaを使った直感的なマップUIと学生がワクワクするようなビジュアル設計を一貫して担当できます。",
      },
    ],
  },
  {
    id: "demo-idea-bamboo-lamp",
    ownerUid: "demo-user-des-sato",
    title: "放置竹林の竹からつくる、サステナブルな和モダン・デスク間接照明ブランド",
    goal: "里山の環境問題となっている放置竹林から伐採した竹を独自の防腐・スリット加工技術で仕上げ、光が優しく広がるインテリア照明として製品化する。",
    fields: ["デザイン", "工学・ものづくり", "その他"],
    roles: [
      {
        name: "木竹材加工・構造エンジニア",
        reason: "竹の油抜きや防虫・防カビ加工、美しい光のスリット切削を安定して行うため",
        skills: ["木工・竹材加工", "材料力学", "CAD製図"],
      },
      {
        name: "LED調光回路・IoTエンジニア",
        reason: "スマホから色温度（電球色〜昼白色）や明るさを心地よく調光できる電子回路を作るため",
        skills: ["LEDドライバ設計", "マイコンプログラミング", "安全基準認証知識"],
      },
      {
        name: "ECブランドディレクター",
        reason: "『環境保全×上質な生活』をテーマに写真撮影、クラウドファンディング、EC販売を主導するため",
        skills: ["商品写真撮影", "ストーリーテリング", "ECサイト運用"],
      },
    ],
    firstSteps: [
      "里山保全ボランティア団体からの放置竹材の調達ルート確保",
      "竹のスリット幅による光の拡散パターンのプロトタイプ検証",
      "市販LEDパーツと竹筒の組み合わせによる熱・安全検証",
    ],
    rawText: "デザインの力で環境問題を解決したい！放置竹林の竹をカットし、計算されたスリットから幻想的な光が漏れるデスク用の和モダン間接照明を企画しています。竹の乾燥や加工が得意な人や、中に組み込むLED回路を作ってくれる工学系・ものづくり系の仲間を求めています！",
    aiSuggestions: [
      {
        studentId: "demo-user-eng-yamamoto",
        displayName: "山本 翔太",
        university: "東京工業大学",
        faculty: "工学院",
        department: "機械系",
        major: "ロボティクス・制御工学",
        skills: "Arduino/Raspberry Pi回路設計、Fusion 360による3Dモデリング、Python、センサー制御",
        matchedRole: "LED調光回路・IoTエンジニア",
        reason: "東工大でハードウェア・マイコン制御を専攻しており、3D CADによる筐体内部構造設計とLED制御回路の実装をワンストップでこなせます。",
      },
    ],
  },
  {
    id: "demo-idea-farm-direct-dorm",
    ownerUid: "demo-user-biz-watanabe",
    title: "地方の余剰農作物を大学の学生寮・一人暮らし学生へ直配する学内サブスク",
    goal: "形が不揃いで市場に出せない規格外野菜を農家から買い取り、学生寮や一人暮らし学生へ1回500円で新鮮野菜を定期配達するフードロス削減サービス。",
    fields: ["ビジネス", "農業・生物"],
    roles: [
      {
        name: "農家ネットワーク・産地調達担当",
        reason: "近郊農家への丁寧な交渉と規格外野菜の集荷スキームを構築するため",
        skills: ["農業知見", "生産者コミュニケーション", "物流調整"],
      },
      {
        name: "定期注文・配送管理システム開発",
        reason: "LINE公式アカウントと連携した簡単な注文・集金・受け渡し管理WEBを作るため",
        skills: ["Webアプリ開発", "LINE Messaging API", "Stripe決済"],
      },
      {
        name: "自炊レシピ提案・コミュニティマネージャー",
        reason: "届いた野菜で簡単に作れる学生向け時短レシピを発信し、継続率を高めるため",
        skills: ["時短自炊レシピ考案", "Instagramリール制作", "コミュニティ運営"],
      },
    ],
    firstSteps: [
      "近郊の野菜農家3件への規格外野菜の廃棄状況ヒアリング",
      "学生寮の住民50名への『自炊と野菜不足に関するアンケート』実施",
      "LINE公式アカウントを用いた初回テスト配達（限定20セット）の実施",
    ],
    rawText: "一人暮らしの学生は野菜不足に悩み、農家さんは規格外野菜の廃棄に悩んでいます。この2つを繋ぐ『学内拠点受け取り型の低価格野菜サブスク』を作りたいです！ビジネスモデルと収支計画は作ってあるので、農家さんとのネットワークがある農学系の人や、LINE連携システムを作れるプログラマーさんを大募集しています！",
    aiSuggestions: [
      {
        studentId: "demo-user-agri-tanaka",
        displayName: "田中 健太",
        university: "東京農工大学",
        faculty: "農学部",
        department: "応用生物科学科",
        major: "発酵微生物学",
        skills: "微生物培養、発酵プロセス管理、土壌成分分析、酵母スクリーニング",
        matchedRole: "農家ネットワーク・産地調達担当",
        reason: "農工大農学部に在籍し、農業・生産現場の知見と農家との信頼構築スキルがあるため、規格外野菜の調達パートナー開拓に適任です。",
      },
      {
        studentId: "demo-user-info-suzuki",
        displayName: "鈴木 結愛",
        university: "早稲田大学",
        faculty: "基幹理工学部",
        department: "情報通信学科",
        major: "Webエンジニアリング",
        skills: "Next.js、React、TypeScript、Tailwind CSS、Firebase、REST API設計",
        matchedRole: "定期注文・配送管理システム開発",
        reason: "TypeScriptとNext.js/Firebaseのスペシャリストであり、注文・受け渡し管理ダッシュボードを迅速にプロトタイピングできます。",
      },
    ],
  },
  {
    id: "demo-idea-science-workshop",
    ownerUid: "demo-user-edu-takahashi",
    title: "身の回りの現象から自然の法則を体感する、小学生向け出張型理科実験ラボ",
    goal: "スライムやペットボトルロケットにとどまらない、本物の大学レベルの科学現象を子ども向けに安全・楽しく演出する体験型実験ワークショップの定期開催。",
    fields: ["教育", "工学・ものづくり"],
    roles: [
      {
        name: "実験コンテンツ開発・化学実験担当",
        reason: "安全でインパクトのある科学実験（色の変化、吸熱発熱、静電気など）を設計するため",
        skills: ["実験安全管理", "化学・物理基礎", "演示実験技術"],
      },
      {
        name: "子ども向けワークブックデザイナー",
        reason: "実験の驚きを家庭でも振り返れるイラスト入りの探求テキストを制作するため",
        skills: ["子ども向けイラスト", "DTP編集", "分かりやすい図解設計"],
      },
      {
        name: "PTA・公民館・学童連携ディレクター",
        reason: "地域の学童保育や公民館、PTAと交渉してワークショップの開催場所を確保するため",
        skills: ["渉外交渉", "イベント運営", "安全保険手続き"],
      },
    ],
    firstSteps: [
      "家庭の台所用品でできる安全な高インパクト実験テーマの3選定",
      "教育学部生による模擬実験デモ（小学生5名参加）の開催",
      "実験ワークブック初版の作成",
    ],
    rawText: "理科離れが進む小学生に『科学ってこんなに魔法みたいで面白いんだ！』と感動してほしい！大学の理系学生とタッグを組んで、地域の児童館や学童に出張するサイエンスラボを立ち上げたいです。実験のタネを一緒に考えてくれる理系学生や、可愛いワークシートを作ってくれる美大生・デザイン系の人を待っています！",
    aiSuggestions: [
      {
        studentId: "demo-user-des-sato",
        displayName: "佐藤 澪",
        university: "武蔵野美術大学",
        faculty: "造形構想学部",
        department: "クリエイティブイノベーション学科",
        major: "UI/UX・ブランディング",
        skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
        matchedRole: "子ども向けワークブックデザイナー",
        reason: "イラストや視覚的図解を得意とし、子どもの好奇心を引き出すワークブックやポスターのビジュアル制作に最も適しています。",
      },
    ],
  },
  {
    id: "demo-idea-barrier-free-map",
    ownerUid: "demo-user-med-kobayashi",
    title: "車椅子・ベビーカー視点で『通れる道』をみんなで可視化するバリアフリーマップ",
    goal: "車椅子ユーザーやベビーカーを押す保護者が、階段・段差・傾斜に阻まれることなく安心して外出できるリアルタイム共有マップアプリの構築。",
    fields: ["医療・福祉", "情報・プログラミング"],
    roles: [
      {
        name: "当事者ヒアリング・アクセシビリティ監修",
        reason: "車椅子ユーザーが本当に困る段差の高さやスロープ勾配の基準を明確にするため",
        skills: ["福祉用具・車椅子知識", "当事者リサーチ", "アクセシビリティ評価"],
      },
      {
        name: "Web/モバイルフロントエンドエンジニア",
        reason: "片手でも操作しやすく、誰でも段差情報を写真付きで投稿できるUIを作るため",
        skills: ["Next.js", "PWA", "Mapbox", "Webアクセシビリティ(WCAG)"],
      },
      {
        name: "自治体・地元商店街アライアンス担当",
        reason: "大学周辺の商店街や行政と連携して車椅子用スロープ設置を推進するため",
        skills: ["行政折衝", "社会福祉計画", "地域連携"],
      },
    ],
    firstSteps: [
      "大学正門から最寄駅までのルートにおける車椅子実走バリア調査",
      "車椅子ユーザー3名への移動の課題に関するインタビュー",
      "スマートフォンの写真アップロード連動マップのPoC実装",
    ],
    rawText: "普段歩いている道も、車椅子に乗ってみるとたった3cmの段差で先に進めなくなります。段差や狭い改札、エレベーターの位置をみんなで登録して助け合えるバリアフリーマップを作りたいです。アクセシビリティを考慮したWebアプリを作れるプログラマーさんや、商店街への設置交渉を一緒にしてくれる人を募集中です！",
    aiSuggestions: [
      {
        studentId: "demo-user-info-suzuki",
        displayName: "鈴木 結愛",
        university: "早稲田大学",
        faculty: "基幹理工学部",
        department: "情報通信学科",
        major: "Webエンジニアリング",
        skills: "Next.js、React、TypeScript、Tailwind CSS、Firebase、REST API設計",
        matchedRole: "Web/モバイルフロントエンドエンジニア",
        reason: "モダンなWebフロントエンドとFirebaseを活用し、誰でも使いやすいアクセシブルなマップUIとリアルタイム投稿機能を実装できます。",
      },
    ],
  },
  {
    id: "demo-idea-compost-campus",
    ownerUid: "demo-user-agri-tanaka",
    title: "学食生ごみをミミズ堆肥で再生し、屋上庭園でハーブを育てる循環型キャンパス",
    goal: "学食の調理クズをキャンパス内で完全消滅型コンポスト処理し、出来上がった良質な堆肥でハーブや食用花を育て、再び学食メニューに還元する循環実証実験。",
    fields: ["農業・生物", "デザイン", "その他"],
    roles: [
      {
        name: "堆肥化・微生物環境エンジニア",
        reason: "臭気を出さず高速に生ごみを分解するミミズ・微生物コンポストの管理を行うため",
        skills: ["土壌微生物", "コンポスト管理", "環境アセスメント"],
      },
      {
        name: "屋上緑化ランドスケープデザイナー",
        reason: "学生が集まりたくなる居心地の良いハーブガーデンの空間設計・木工ベンチを制作するため",
        skills: ["空間デザイン", "木工加工", "植栽プランニング"],
      },
      {
        name: "学食コラボメニュー企画・広報",
        reason: "収穫したハーブを使った限定カフェメニューを学食業者と共同企画するため",
        skills: ["メニュー開発", "ポスター制作", "学内メディア取材誘致"],
      },
    ],
    firstSteps: [
      "大学学食から排出される1日あたりの生ごみ量の実測調査",
      "小型ミミズコンポスト容器の試作と分解速度実験",
      "屋上利用に関する大学施設課へのヒアリング",
    ],
    rawText: "大学の学食から毎日大量に捨てられる生ごみを見るのが悔しいです！ミミズ堆肥の仕組みを使って無臭で栄養豊富な土に変え、屋上でミントやローズマリーを栽培して学食のカフェで提供する完全循環型のキャンパスを作りたいです！空間をカッコよくデザインしてくれる建築・デザイン系の人、一緒にやりませんか？",
    aiSuggestions: [
      {
        studentId: "demo-user-des-sato",
        displayName: "佐藤 澪",
        university: "武蔵野美術大学",
        faculty: "造形構想学部",
        department: "クリエイティブイノベーション学科",
        major: "UI/UX・ブランディング",
        skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
        matchedRole: "屋上緑化ランドスケープデザイナー",
        reason: "空間デザインとブランディングの知見を活かし、学生が自然と集まりたくなるお洒落な屋上ハーブガーデンの空間設計を担当できます。",
      },
    ],
  },
  {
    id: "demo-idea-smart-cane",
    ownerUid: "demo-user-eng-yamamoto",
    title: "振動と骨伝導音で障害物までの距離を直感的に伝える、AI搭載スマート白杖",
    goal: "超音波センサーとエッジAIカメラを白杖に組み込み、上空の出っ張りや路面の段差、歩行者信号の青を検知して手元の触覚フィードバックで伝える次世代白杖。",
    fields: ["工学・ものづくり", "医療・福祉"],
    roles: [
      {
        name: "センサー統合・エッジ回路開発エンジニア",
        reason: "超音波ToFセンサーと振動モーターを白杖のグリップ内に高密度実装するため",
        skills: ["組み込みC/C++", "電子回路設計", "LiPoバッテリー制御"],
      },
      {
        name: "軽量画像認識AIエンジニア",
        reason: "小型カメラで点字ブロックや信号の色を瞬時に認識する軽量モデルを実装するため",
        skills: ["YOLO/TensorFlow Lite", "エッジAI", "画像処理"],
      },
      {
        name: "視覚障がい当事者フィードバックコーディネーター",
        reason: "盲学校や当事者団体でのモニタリングテストを実施し、安全基準を満たすため",
        skills: ["視覚障がいリハビリテーション", "臨床工学", "ユーザー評価"],
      },
    ],
    firstSteps: [
      "グリップ内蔵型振動モーターによる距離別触覚パターンの触知テスト",
      "小型ToFセンサーによる胸の高さの障害物検知精度の検証",
      "視覚障がい者団体へのヒアリングと安全設計ガイドラインの確認",
    ],
    rawText: "白杖は地面の段差は分かりますが、頭や胸の高さにある標識や看板にはぶつかってしまう危険があります。超音波センサーで空間の障害物を察知し、振動で直感的に教えるスマート白杖を作りたいです！回路設計ができる人、AIカメラ認識を軽量化できる情報系の人、福祉の現場に詳しい人とチームを組みたいです！",
    aiSuggestions: [
      {
        studentId: "demo-user-med-kobayashi",
        displayName: "小林 大地",
        university: "慶應義塾大学",
        faculty: "看護医療学部",
        department: "看護学科",
        major: "リハビリテーション・在宅福祉",
        skills: "理学療法基礎、当事者ヒアリング、バリアフリー調査、福祉用具選定",
        matchedRole: "視覚障がい当事者フィードバックコーディネーター",
        reason: "リハビリテーションと福祉用具の専門知識を持ち、当事者が本当に安心できる触覚フィードバックの検証と臨床評価をリードできます。",
      },
    ],
  },
  {
    id: "demo-idea-gakushoku-recipe",
    ownerUid: "demo-user-biz-watanabe",
    title: "全国の大学の隠れた名物学食メニューを発掘・アーカイブ・商品化する学生PJ",
    goal: "全国の大学で学生に愛されながらレシピが失われつつある名物学食メニューを取材・アーカイブし、レトルト食品やキッチンカーとして現代に復刻・商品化する。",
    fields: ["ビジネス", "教育", "その他"],
    roles: [
      {
        name: "レシピ再現・食品試作ディレクター",
        reason: "取材記録から味の再現と、OEM工場で量産可能な食品規格に落とし込むため",
        skills: ["調理学", "栄養学", "食品開発・試作"],
      },
      {
        name: "Webマガジン編集長・フォトグラファー",
        reason: "各大学の学食のおじちゃん・おばちゃんへの熱い取材記事をWEBで発信するため",
        skills: ["インタビュー取材", "一眼レフ撮影", "記事ライティング"],
      },
      {
        name: "催事・キッチンカー・物産展アライアンス",
        reason: "学園祭や地域のマルシェ、百貨店の物産展への出店交渉と販売管理を仕切るため",
        skills: ["イベント出店交渉", "PL管理", "現場オペレーション"],
      },
    ],
    firstSteps: [
      "都内3大学の老舗学食への『名物メニューの歴史と製法』の取材",
      "学食人気No.1タレの家庭用レシピ試作会（学生15名試食）",
      "WEBマガジン『大学めし図鑑』の公式note開設",
    ],
    rawText: "大学の学食って、その大学の歴史や学生の思い出が詰まった最高のカルチャーです！少子化やリニューアルで消えゆく名物メニューのレシピを大学生の手でアーカイブし、レトルト化や学祭フェスで復活させたいです！料理が好きな家政・栄養系の人や、文章や写真が得意なメディア系の人、一緒に全国の学食をめぐりましょう！",
    aiSuggestions: [
      {
        studentId: "demo-user-des-sato",
        displayName: "佐藤 澪",
        university: "武蔵野美術大学",
        faculty: "造形構想学部",
        department: "クリエイティブイノベーション学科",
        major: "UI/UX・ブランディング",
        skills: "Figma、Illustrator、Photoshop、ロゴデザイン、ユーザーリサーチ、パッケージデザイン",
        matchedRole: "Webマガジン編集長・フォトグラファー",
        reason: "写真撮影、誌面レイアウト、Webマガジンのトータルブランディングを一貫して手がけ、魅力的なコンテンツを発信できます。",
      },
    ],
  },
];

async function seed() {
  console.log("🌱 HIVE デモ用シードデータの投入を開始します...");
  const db = getAdminDb();

  // 1. デモ用ユーザーの投入
  console.log("👤 学生プロフィール（7名）を投入中...");
  for (const user of SEED_USERS) {
    const userRef = db.collection("users").doc(user.uid);
    await userRef.set(
      {
        displayName: user.displayName,
        university: user.university,
        faculty: user.faculty,
        department: user.department,
        major: user.major,
        skills: user.skills,
        motivation: user.motivation,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`  ✓ ユーザー登録: ${user.displayName} (${user.university})`);
  }

  // 2. デモ用アイデア10件の投入
  console.log("\n💡 公開アイデア（10件）を投入中...");
  const now = Date.now();
  for (let i = 0; i < SEED_IDEAS.length; i++) {
    const idea = SEED_IDEAS[i];
    const ideaRef = db.collection("ideas").doc(idea.id);

    // 公開日時を過去数日〜数時間前のリアルな日時に設定（新しい順に並ぶように時間差をつける）
    const hoursAgo = (SEED_IDEAS.length - i) * 6;
    const publishedDate = new Date(now - hoursAgo * 3600 * 1000);

    await ideaRef.set({
      ownerUid: idea.ownerUid,
      rawText: idea.rawText,
      questions: [
        "このプロジェクトで最も解決したい具体的な課題は何ですか？",
        "想定している最初のターゲットや利用者は誰ですか？",
        "実現にあたってチームに最も不足している専門性は何ですか？",
      ],
      answers: [
        "課題の具体化と現場のニーズのすり合わせを進めています。",
        "大学生および地域コミュニティの関心層を想定しています。",
        "他分野のスキルを持った熱意ある仲間が必要です。",
      ],
      result: {
        title: idea.title,
        goal: idea.goal,
        fields: idea.fields,
        roles: idea.roles,
        firstSteps: idea.firstSteps,
      },
      status: "published",
      aiSuggestions: idea.aiSuggestions,
      aiSuggestedAt: FieldValue.serverTimestamp(),
      createdAt: publishedDate,
      updatedAt: publishedDate,
      publishedAt: publishedDate,
    });
    console.log(`  ✓ アイデア登録 [${idea.fields.join(", ")}]: ${idea.title}`);
  }

  console.log("\n🎉 デモ用シードデータの投入がすべて完了しました！");
}

seed().catch((err) => {
  console.error("❌ シード投入エラー:", err);
  process.exit(1);
});
