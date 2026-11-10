import { getAdminDb, FieldValue } from "../src/lib/firebase-admin";

/**
 * HIVE ハッカソン審査用デモデータ投入スクリプト
 * 1. 3つのプロジェクトへの追加会話（30件）
 * 2. 過去に終了したプロジェクト（7件）＋メンバー＋成果
 * 3. 相互評価（120件、放置竹林＋過去7プロジェクト）
 * 4. 各学生の joinedProjectIds の更新
 */

// 学生10人のマッピング
interface StudentMeta {
  uid: string;
  name: string;
  school: string;
}

const STUDENTS: Record<string, StudentMeta> = {
  "田中 健太": { uid: "student-male-tanaka", name: "田中 健太", school: "東京農工大学" },
  "山本 翔太": { uid: "student-male-yamamoto", name: "山本 翔太", school: "電気通信大学" },
  "渡辺 航": { uid: "student-male-watanabe", name: "渡辺 航", school: "一橋大学" },
  "小林 大地": { uid: "student-male-kobayashi", name: "小林 大地", school: "筑波大学" },
  "中村 蓮": { uid: "student-male-nakamura", name: "中村 蓮", school: "東京工業大学" },
  "鈴木 結愛": { uid: "student-female-suzuki", name: "鈴木 結愛", school: "お茶の水女子大学" },
  "佐藤 澪": { uid: "student-female-sato", name: "佐藤 澪", school: "多摩美術大学" },
  "高橋 陽菜": { uid: "student-female-takahashi", name: "高橋 陽菜", school: "東京学芸大学" },
  "伊藤 葵": { uid: "student-female-ito", name: "伊藤 葵", school: "早稲田大学" },
  "松本 さくら": { uid: "student-female-matsumoto", name: "松本 さくら", school: "上智大学" },
};

// A. チャット会話 30件の生データ
interface RawChat {
  projectKey: "craft-beer" | "campus-map" | "bamboo-light";
  datetime: string; // YYYY-MM-DD HH:mm
  senderName: string;
  text: string;
}

const RAW_CHATS: RawChat[] = [
  // ─── 地域伝統クラフトビール開発 ───
  { projectKey: "craft-beer", datetime: "2026-09-09 10:15", senderName: "渡辺 航", text: "松本さん、地域調査のリサーチありがとう！「果実やハーブの香り」という方向性はすごく具体性があって助かる。" },
  { projectKey: "craft-beer", datetime: "2026-09-09 11:00", senderName: "佐藤 澪", text: "渡辺さん、松本さんの調査結果を受けて、ボトルデザインに使うモチーフのスケッチをいくつか試作してみてもいいですか？" },
  { projectKey: "craft-beer", datetime: "2026-09-09 11:30", senderName: "渡辺 航", text: "ぜひお願いしたい！醸造所の選定と並行して進めたいので、初期案ができたら見せてほしいな。" },
  { projectKey: "craft-beer", datetime: "2026-09-21 10:00", senderName: "田中 健太", text: "渡辺さん、醸造所との共同試作決定ありがとうございます！醸造所の担当者さんと技術的な打ち合わせに入りたいのですが、仕込みのタイミングって調整可能ですか？" },
  { projectKey: "craft-beer", datetime: "2026-09-21 11:20", senderName: "渡辺 航", text: "うん、醸造所側からは10月上旬の仕込み枠を確保できたと連絡があったよ。田中くんの設計スケジュールと合わせられそう？" },
  { projectKey: "craft-beer", datetime: "2026-09-21 14:00", senderName: "田中 健太", text: "完璧です！では9月末までに柑橘ピールを使ったペールエールの試作レシピを完成させます。" },
  { projectKey: "craft-beer", datetime: "2026-10-13 11:00", senderName: "松本 さくら", text: "田中さん、試飲の評価シートを作り始めたいのですが、質問項目ってどんな基準を入れるのが良さそうですか？" },
  { projectKey: "craft-beer", datetime: "2026-10-13 13:30", senderName: "田中 健太", text: "松本さん、ありがとうございます！「香りの強さ」「後味のキレ」「特産品らしさ」の3点は必須で入れてもらえると助かります！" },
  { projectKey: "craft-beer", datetime: "2026-10-13 14:10", senderName: "松本 さくら", text: "了解しました！その3項目を軸にした案を、明日みんなに共有しますね。" },
  { projectKey: "craft-beer", datetime: "2026-11-06 09:30", senderName: "佐藤 澪", text: "渡辺さん、昨日は醸造所での瓶詰め立ち会いお疲れ様でした！実物の瓶の写真を送ってもらえたりしますか？ラベルの最終位置合わせに使いたいです。" },

  // ─── 学内空き教室リアルタイム共有 ───
  { projectKey: "campus-map", datetime: "2026-09-19 09:30", senderName: "鈴木 結愛", text: "中村くん、API仕様書の作成ありがとう！フロント側から教室の混雑状況を取得するエンドポイントって、レスポンスの形式はどうなる予定？" },
  { projectKey: "campus-map", datetime: "2026-09-19 10:15", senderName: "中村 蓮", text: "鈴木さん、JSON形式で各教室のIDと混雑率（0〜100%）を返す仕様にしてるよ。フロント側でパーセント表記に変換しやすいようにしてみた。" },
  { projectKey: "campus-map", datetime: "2026-09-19 10:45", senderName: "鈴木 結愛", text: "助かる！それならダッシュボードのUIパーツにそのまま流し込めそう。" },
  { projectKey: "campus-map", datetime: "2026-09-29 13:00", senderName: "伊藤 葵", text: "中村さん、昨日お話しした予測アルゴリズムの件ですが、過去データからの混雑予測値をAPI経由でDBに書き込む処理、負荷は大丈夫そうでしょうか？" },
  { projectKey: "campus-map", datetime: "2026-09-29 14:20", senderName: "中村 蓮", text: "伊藤さん、15分おきのバッチ更新ならDBの負荷は問題ないと思う！10月の負荷テストでその条件も検証してみるね。" },
  { projectKey: "campus-map", datetime: "2026-10-27 10:00", senderName: "高橋 陽菜", text: "みなさん、昨日からチームに参加した高橋です！案内資料の作成を担当するのですが、ターゲットは新入生メインで考えて大丈夫でしょうか？" },
  { projectKey: "campus-map", datetime: "2026-10-27 10:30", senderName: "鈴木 結愛", text: "高橋さん、ご参加ありがとうございます！そうですね、キャンパスの移動に慣れていない1〜2年生をメインターゲットにしてもらえると助かります！" },
  { projectKey: "campus-map", datetime: "2026-10-27 11:15", senderName: "高橋 陽菜", text: "了解です！「探し方」「見方」「問い合わせ」の3章構成で、図解多めのわかりやすい構成案を作成してみます。" },
  { projectKey: "campus-map", datetime: "2026-11-03 14:00", senderName: "中村 蓮", text: "鈴木さん、β版の結合テスト完了お疲れ様でした！API側の応答も安定してます。" },
  { projectKey: "campus-map", datetime: "2026-11-03 14:40", senderName: "鈴木 結愛", text: "中村くんサポートありがとう！これで11/15の実証テスト環境公開に向けて、安心してUIの微調整に入れそうです。" },

  // ─── 放置竹林サステナブル照明（第1期） ───
  { projectKey: "bamboo-light", datetime: "2026-09-08 10:00", senderName: "山本 翔太", text: "佐藤さん、竹シェードのデザイン案3つ見ました！どれも魅力的だけど、加工のしやすさで言うとどれが一番おすすめ？" },
  { projectKey: "bamboo-light", datetime: "2026-09-08 11:15", senderName: "佐藤 澪", text: "山本さん、B案の割竹を組み合わせるタイプが一番構造的に安定していて、加工の手間も抑えられると思います！" },
  { projectKey: "bamboo-light", datetime: "2026-09-08 13:00", senderName: "山本 翔太", text: "なるほど、じゃあB案をベースに、切削加工と回路基板の配置設計を進めるね！" },
  { projectKey: "bamboo-light", datetime: "2026-09-19 14:00", senderName: "小林 大地", text: "渡辺さん、収益還元モデルの試算ありがとうございます！保全活動への15%還元って、竹材の仕入れ費用とは別枠という認識で合ってますか？" },
  { projectKey: "bamboo-light", datetime: "2026-09-19 15:30", senderName: "渡辺 航", text: "小林さん、ご質問ありがとうございます！はい、竹材の購入費とは別に、売上の利益から15%を整備に回す計算にしています。" },
  { projectKey: "bamboo-light", datetime: "2026-09-19 16:10", senderName: "小林 大地", text: "確認できて良かったです！それなら地域の方々にも説明がしやすく、安心しておすすめできますね。" },
  { projectKey: "bamboo-light", datetime: "2026-10-11 09:30", senderName: "小林 大地", text: "山本さん、試作品の完成お疲れ様です！スイッチ部の押し心地を試してみたのですが、すごく軽くて操作しやすいですね。" },
  { projectKey: "bamboo-light", datetime: "2026-10-11 10:40", senderName: "山本 翔太", text: "小林さんが前に提案してくれたスイッチの形を取り入れたおかげだよ、アドバイスありがとう！" },
  { projectKey: "bamboo-light", datetime: "2026-10-21 09:00", senderName: "渡辺 航", text: "佐藤さん、昨日のギャラリー展示お疲れ様でした！来場者の方々からのフィードバックってどんな感じでしたか？" },
  { projectKey: "bamboo-light", datetime: "2026-10-21 10:15", senderName: "佐藤 澪", text: "渡辺さん、「竹の間伐材とは思えない高級感がある」という声を多くいただけました！量産化を期待するコメントも多かったです。" },
];

const PROJECT_ID_MAP = {
  "craft-beer": "demo-idea-craft-beer",
  "campus-map": "demo-idea-campus-map",
  "bamboo-light": "demo-completed-pj",
};

// B. 過去に終了したプロジェクト 7件
interface PastProjectMember {
  name: string;
  role: string;
  isFacilitator: boolean;
}

interface PastProject {
  id: string;
  title: string;
  period: string;
  goal: string;
  achievements: string;
  members: PastProjectMember[];
}

const PAST_PROJECTS: PastProject[] = [
  {
    id: "past-pj-walking-assist",
    title: "高齢者向け歩行アシストギア検証",
    period: "2025-04-10 〜 2025-07-30",
    goal: "地域の高齢者の散歩を支える軽い脚部アシストギアの試作品を作り、実際に使ってもらって評価する。",
    achievements: "地域の方々による体験会を開き、歩くときの負担が軽くなったという声を多くいただいた。軽量化と着けやすさの改善点をレポートにまとめて終了した。",
    members: [
      { name: "山本 翔太", role: "ハードウェア・構造設計", isFacilitator: true },
      { name: "小林 大地", role: "アクセシビリティ・見守り", isFacilitator: false },
      { name: "渡辺 航", role: "事業性の検証・費用の試算", isFacilitator: false },
      { name: "松本 さくら", role: "聞き取り・利用者調査", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-disaster-edu",
    title: "地理情報連携防災教育デジタル教材",
    period: "2025-06-01 〜 2025-09-30",
    goal: "小学生が地域のハザードマップをゲーム感覚で学べるデジタル教材を作る。",
    achievements: "近くの小学校で出前授業を行い、子どもたちの防災への関心が高まったことを確かめた。教育委員会への教材導入の提案書をまとめて終了した。",
    members: [
      { name: "高橋 陽菜", role: "教育カリキュラム設計", isFacilitator: true },
      { name: "鈴木 結愛", role: "フロントエンド開発", isFacilitator: false },
      { name: "中村 蓮", role: "地図データの連携・バックエンド", isFacilitator: false },
      { name: "伊藤 葵", role: "地域の災害データの分析と見える化", isFacilitator: false },
      { name: "佐藤 澪", role: "UI デザイン・イラスト制作", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-agritech-event",
    title: "食育体験型アグリテックイベント",
    period: "2025-09-15 〜 2025-12-20",
    goal: "都市部の子ども向けに、野菜の発酵と調理の過程を学べるワークショップと、センサー付きの植物の展示を行う。",
    achievements: "2日間のイベントに多くの親子連れが参加した。アンケートでは「発酵の仕組みが楽しく学べた」という感想が多く、無事に終了した。",
    members: [
      { name: "田中 健太", role: "発酵の解説・ワークショップ設計", isFacilitator: false },
      { name: "高橋 陽菜", role: "子ども向け教育プログラムの進行", isFacilitator: true },
      { name: "山本 翔太", role: "水分・温度を測るセンサー機器の制作", isFacilitator: false },
      { name: "渡辺 航", role: "イベントの収支計画・集客", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-wheelchair-nav",
    title: "学内車椅子ナビゲーションアプリ",
    period: "2025-11-01 〜 2026-02-28",
    goal: "キャンパス内のバリアフリーの道順や段差の情報を案内するスマホアプリを作る。",
    achievements: "学内の主な坂道とエレベーターの位置を網羅したアプリの試作品を完成させ、学内のバリアフリー推進の部署に引き継いだ。",
    members: [
      { name: "小林 大地", role: "バリアフリーの実態調査・企画", isFacilitator: true },
      { name: "鈴木 結愛", role: "アプリの画面の開発", isFacilitator: false },
      { name: "中村 蓮", role: "位置情報のデータベース・バックエンド", isFacilitator: false },
      { name: "佐藤 澪", role: "アイコン・地図のデザイン", isFacilitator: false },
      { name: "松本 さくら", role: "車椅子を使う学生への事前調査", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-craft-archive",
    title: "伝統工芸デジタルアーカイブ・WEB展覧会",
    period: "2026-01-10 〜 2026-04-30",
    goal: "地域の伝統工芸品の制作工程や職人の技術を、3D モデルと映像で紹介する Web サイトを公開する。",
    achievements: "5つの伝統工芸の 3D データを Web で公開した。職人の方々から、技術を受け継ぐための記録として喜ばれて終了した。",
    members: [
      { name: "佐藤 澪", role: "Web デザイン・ビジュアル制作", isFacilitator: true },
      { name: "鈴木 結愛", role: "Web サイトの構築", isFacilitator: false },
      { name: "伊藤 葵", role: "閲覧データの分析・ダッシュボード作成", isFacilitator: false },
      { name: "渡辺 航", role: "職人への取材交渉・取りまとめ", isFacilitator: false },
      { name: "松本 さくら", role: "閲覧者への意識調査・聞き取り", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-remote-study",
    title: "リモート学習集中度モニタリングツール",
    period: "2026-03-01 〜 2026-06-15",
    goal: "オンライン講義での受講生の反応や学習の記録を分析し、講師に伝える学習支援ツールを試作する。",
    achievements: "模擬講義で実験を行い、講義の流れに合わせた受講生の関心の変化を見えるようにできた。分析結果を学会発表用の論文にまとめた。",
    members: [
      { name: "伊藤 葵", role: "学習データの分析・機械学習モデル作成", isFacilitator: true },
      { name: "高橋 陽菜", role: "教育効果の検証・アンケート設計", isFacilitator: false },
      { name: "中村 蓮", role: "記録を集めるサーバーの構築", isFacilitator: false },
      { name: "田中 健太", role: "実験データの整理・テスト受講", isFacilitator: false },
    ],
  },
  {
    id: "past-pj-fruit-drink",
    title: "規格外果実の清涼飲料水商品化マーケティング",
    period: "2026-05-10 〜 2026-08-31",
    goal: "捨てられてしまう規格外の果実を使った清涼飲料水の味を選び、売り出し方を考える（地元の清涼飲料の製造会社と共同で開発）。",
    achievements: "製造会社との共同試作で3種類の試作品を完成させ、消費者調査の結果をもとにした商品化の提案書を製造会社に渡した。",
    members: [
      { name: "田中 健太", role: "果汁の成分分析・製造会社との調整", isFacilitator: false },
      { name: "渡辺 航", role: "マーケティング戦略・価格設定", isFacilitator: true },
      { name: "松本 さくら", role: "消費者の好みの調査", isFacilitator: false },
      { name: "小林 大地", role: "成分表示・アレルギー表示の調査", isFacilitator: false },
    ],
  },
];

// C. 相互評価 120件の生テキスト
const RAW_EVAL_TEXT = `
放置竹林サステナブル照明（第1期）｜山本 翔太 → 小林 大地｜貢献4 信頼5 協調5 発信4｜ユニバーサルデザインの視点から具体的な改善案を出してくれた。
放置竹林サステナブル照明（第1期）｜山本 翔太 → 佐藤 澪｜貢献5 信頼5 協調4 発信4｜竹の魅力を引き出す洗練されたデザインを提示してくれた。
放置竹林サステナブル照明（第1期）｜山本 翔太 → 渡辺 航｜貢献4 信頼4 協調4 発信4｜保全活動への還元の仕組みをきっちり試算してくれた。
放置竹林サステナブル照明（第1期）｜小林 大地 → 山本 翔太｜貢献5 信頼5 協調4 発信4｜安全性を考慮した回路設計と組み込みを迅速に行ってくれた。
放置竹林サステナブル照明（第1期）｜小林 大地 → 佐藤 澪｜貢献4 信頼4 協調4 発信3｜安全面に配慮した形状の相談に柔軟に乗ってくれた。
放置竹林サステナブル照明（第1期）｜小林 大地 → 渡辺 航｜貢献4 信頼4 協調4 発信3｜事業性と社会的意義のバランスが取れた企画を作ってくれた。
放置竹林サステナブル照明（第1期）｜佐藤 澪 → 山本 翔太｜貢献5 信頼5 協調5 発信4｜複雑なデザイン案を正確に製品構造へ落とし込んでくれた。
放置竹林サステナブル照明（第1期）｜佐藤 澪 → 小林 大地｜貢献4 信頼4 協調4 発信3｜誰でも扱いやすいスイッチ構造の助言が的確だった。
放置竹林サステナブル照明（第1期）｜佐藤 澪 → 渡辺 航｜貢献4 信頼4 協調4 発信4｜展示会場での説明や来場者対応をスムーズに進めてくれた。
放置竹林サステナブル照明（第1期）｜渡辺 航 → 山本 翔太｜貢献5 信頼5 協調4 発信4｜試作品の完成までスケジュール通り進行役を務めてくれた。
放置竹林サステナブル照明（第1期）｜渡辺 航 → 小林 大地｜貢献4 信頼4 協調5 発信3｜利用者の安全に関する確認作業を丁寧に行ってくれた。
放置竹林サステナブル照明（第1期）｜渡辺 航 → 佐藤 澪｜貢献4 信頼5 協調4 発信4｜展示で来場者から高い評価を得るビジュアルを作ってくれた。
高齢者向け歩行アシストギア検証｜山本 翔太 → 小林 大地｜貢献5 信頼5 協調4 発信4｜体験者への配慮が行き届いており評価の質が高まった。
高齢者向け歩行アシストギア検証｜山本 翔太 → 渡辺 航｜貢献4 信頼4 協調4 発信3｜部材の調達費用の削減に貢献してくれた。
高齢者向け歩行アシストギア検証｜山本 翔太 → 松本 さくら｜貢献4 信頼4 協調5 発信4｜高齢者への聞き取り調査を根気強く実施してくれた。
高齢者向け歩行アシストギア検証｜小林 大地 → 山本 翔太｜貢献5 信頼5 協調4 発信3｜ギアの重さのバランスを限界まで調整してくれた。
高齢者向け歩行アシストギア検証｜小林 大地 → 渡辺 航｜貢献3 信頼4 協調4 発信3｜収支の見込みを過不足なくまとめてくれた。
高齢者向け歩行アシストギア検証｜小林 大地 → 松本 さくら｜貢献4 信頼4 協調5 発信4｜利用者の生の声を上手く引き出して課題を見えるようにした。
高齢者向け歩行アシストギア検証｜渡辺 航 → 山本 翔太｜貢献4 信頼5 協調4 発信4｜ハードウェアの不具合に迅速に対応してくれた。
高齢者向け歩行アシストギア検証｜渡辺 航 → 小林 大地｜貢献5 信頼5 協調4 発信4｜体験会での安全管理を徹底して行ってくれた。
高齢者向け歩行アシストギア検証｜渡辺 航 → 松本 さくら｜貢献4 信頼4 協調4 発信4｜調査データのとりまとめが非常に丁寧だった。
高齢者向け歩行アシストギア検証｜松本 さくら → 山本 翔太｜貢献4 信頼5 協調4 発信3｜試作品の調整の要望に快く応じてくれた。
高齢者向け歩行アシストギア検証｜松本 さくら → 小林 大地｜貢献5 信頼5 協調5 発信4｜対象者に寄り添った調査設計を行ってくれた。
高齢者向け歩行アシストギア検証｜松本 さくら → 渡辺 航｜貢献3 信頼4 協調4 発信3｜外部との連絡窓口をしっかりこなしてくれた。
地理情報連携防災教育デジタル教材｜高橋 陽菜 → 鈴木 結愛｜貢献5 信頼5 協調4 発信4｜子どもが直感的に操作できる画面を実装してくれた。
地理情報連携防災教育デジタル教材｜高橋 陽菜 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜ハザードマップのデータとの接続を安定させてくれた。
地理情報連携防災教育デジタル教材｜高橋 陽菜 → 伊藤 葵｜貢献4 信頼5 協調4 発信3｜難しい災害データを分かりやすく指標にしてくれた。
地理情報連携防災教育デジタル教材｜高橋 陽菜 → 佐藤 澪｜貢献5 信頼5 協調5 発信4｜子どもたちが喜ぶ親しみやすいイラストを描いてくれた。
地理情報連携防災教育デジタル教材｜鈴木 結愛 → 高橋 陽菜｜貢献5 信頼5 協調5 発信5｜出前授業の指導案が素晴らしく進行も完璧だった。
地理情報連携防災教育デジタル教材｜鈴木 結愛 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜画面からのデータの要望に即座に対応してくれた。
地理情報連携防災教育デジタル教材｜鈴木 結愛 → 伊藤 葵｜貢献4 信頼4 協調4 発信4｜分析データの見せ方を提案してくれた。
地理情報連携防災教育デジタル教材｜鈴木 結愛 → 佐藤 澪｜貢献4 信頼5 協調4 発信4｜デザインの素材の納品が早くて助かった。
地理情報連携防災教育デジタル教材｜中村 蓮 → 高橋 陽菜｜貢献4 信頼4 協調5 発信4｜現場のニーズを的確に仕様へ落とし込んでくれた。
地理情報連携防災教育デジタル教材｜中村 蓮 → 鈴木 結愛｜貢献5 信頼5 協調4 発信4｜開発の作業の切り分けと管理が上手だった。
地理情報連携防災教育デジタル教材｜中村 蓮 → 伊藤 葵｜貢献4 信頼4 協調4 発信3｜データの構造の整理が綺麗で開発が楽だった。
地理情報連携防災教育デジタル教材｜中村 蓮 → 佐藤 澪｜貢献3 信頼4 協調4 発信3｜画面素材の解像度調整に快く対応してくれた。
地理情報連携防災教育デジタル教材｜伊藤 葵 → 高橋 陽菜｜貢献4 信頼5 協調5 発信4｜教育の観点からの意見が的確だった。
地理情報連携防災教育デジタル教材｜伊藤 葵 → 鈴木 結愛｜貢献4 信頼4 協調4 発信4｜実装上の制約をわかりやすく教えてくれた。
地理情報連携防災教育デジタル教材｜伊藤 葵 → 中村 蓮｜貢献4 信頼5 協調4 発信3｜データ連携のトラブル時に迅速に原因を突き止めてくれた。
地理情報連携防災教育デジタル教材｜伊藤 葵 → 佐藤 澪｜貢献4 信頼4 協調4 発信3｜グラフの見やすさを意識した配色をしてくれた。
地理情報連携防災教育デジタル教材｜佐藤 澪 → 高橋 陽菜｜貢献5 信頼5 協調5 発信4｜子どもの反応を踏まえたデザインの修正案を出してくれた。
地理情報連携防災教育デジタル教材｜佐藤 澪 → 鈴木 結愛｜貢献4 信頼5 協調4 発信4｜デザインの意図を正確に画面に反映してくれた。
地理情報連携防災教育デジタル教材｜佐藤 澪 → 中村 蓮｜貢献3 信頼4 協調4 発信3｜システムの技術的な限界を事前に共有してくれた。
地理情報連携防災教育デジタル教材｜佐藤 澪 → 伊藤 葵｜貢献4 信頼4 協調4 発信3｜必要なデータの形を明確に伝えてくれてやりやすかった。
食育体験型アグリテックイベント｜田中 健太 → 高橋 陽菜｜貢献5 信頼5 協調5 発信5｜子どもたちの興味を引く解説の仕方を見事に作り上げた。
食育体験型アグリテックイベント｜田中 健太 → 山本 翔太｜貢献4 信頼4 協調4 発信3｜展示用の小型センサー機器を頑丈に作ってくれた。
食育体験型アグリテックイベント｜田中 健太 → 渡辺 航｜貢献4 信頼4 協調4 発信4｜会場の手配や予算管理を滞りなく進めてくれた。
食育体験型アグリテックイベント｜高橋 陽菜 → 田中 健太｜貢献5 信頼5 協調4 発信4｜専門的な発酵の話を分かりやすく噛み砕いてくれた。
食育体験型アグリテックイベント｜高橋 陽菜 → 山本 翔太｜貢献4 信頼4 協調4 発信3｜子どもが触っても安全な筐体を設計してくれた。
食育体験型アグリテックイベント｜高橋 陽菜 → 渡辺 航｜貢献4 信頼4 協調5 発信4｜当日の受付の流れや誘導の計画が完璧だった。
食育体験型アグリテックイベント｜山本 翔太 → 田中 健太｜貢献4 信頼4 協調4 発信3｜センサーの設置環境について的確な助言をくれた。
食育体験型アグリテックイベント｜山本 翔太 → 高橋 陽菜｜貢献5 信頼5 協調5 発信4｜イベント全体の時間の管理を見事にこなした。
食育体験型アグリテックイベント｜山本 翔太 → 渡辺 航｜貢献3 信頼4 協調4 発信3｜備品購入の経理処理を迅速に行ってくれた。
食育体験型アグリテックイベント｜渡辺 航 → 田中 健太｜貢献4 信頼5 協調4 発信4｜専門知識を生かした内容で満足度を高めた。
食育体験型アグリテックイベント｜渡辺 航 → 高橋 陽菜｜貢献5 信頼5 協調5 発信4｜来場者対応を先導して現場を盛り上げてくれた。
食育体験型アグリテックイベント｜渡辺 航 → 山本 翔太｜貢献4 信頼4 協調4 発信3｜限られた予算内で機材を揃えてくれて助かった。
学内車椅子ナビゲーションアプリ｜小林 大地 → 鈴木 結愛｜貢献5 信頼5 協調4 発信4｜車椅子を使う人が押しやすいボタンの配置を実現してくれた。
学内車椅子ナビゲーションアプリ｜小林 大地 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜たくさんの道順のデータを速く処理するサーバーを作った。
学内車椅子ナビゲーションアプリ｜小林 大地 → 佐藤 澪｜貢献4 信頼5 協調5 発信4｜見分けやすい配色の地図を作ってくれた。
学内車椅子ナビゲーションアプリ｜小林 大地 → 松本 さくら｜貢献4 信頼4 協調4 発信4｜聞き取り調査から本質的な課題を抽出してくれた。
学内車椅子ナビゲーションアプリ｜鈴木 結愛 → 小林 大地｜貢献5 信頼5 協調5 発信4｜実際の車椅子利用時の視点を細かく共有してくれた。
学内車椅子ナビゲーションアプリ｜鈴木 結愛 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜応答の速さの改善に粘り強く取り組んでくれた。
学内車椅子ナビゲーションアプリ｜鈴木 結愛 → 佐藤 澪｜貢献4 信頼4 協調4 発信3｜画面の部品の提供が非常にスムーズだった。
学内車椅子ナビゲーションアプリ｜鈴木 結愛 → 松本 さくら｜貢献3 信頼4 協調4 発信3｜利用者の行動の分析結果が明快だった。
学内車椅子ナビゲーションアプリ｜中村 蓮 → 小林 大地｜貢献4 信頼4 協調4 発信4｜現場調査のデータを綺麗な形で共有してくれた。
学内車椅子ナビゲーションアプリ｜中村 蓮 → 鈴木 結愛｜貢献4 信頼5 協調4 発信4｜仕様変更にも迅速に画面を修正してくれた。
学内車椅子ナビゲーションアプリ｜中村 蓮 → 佐藤 澪｜貢献3 信頼4 協調4 発信3｜アイコン画像の形式の指定に合わせてくれた。
学内車椅子ナビゲーションアプリ｜中村 蓮 → 松本 さくら｜貢献4 信頼4 協調4 発信3｜調査結果の優先度付けが的確で実装しやすかった。
学内車椅子ナビゲーションアプリ｜佐藤 澪 → 小林 大地｜貢献4 信頼5 協調5 発信4｜アクセシビリティの決まりについて詳しく教えてくれた。
学内車椅子ナビゲーションアプリ｜佐藤 澪 → 鈴木 結愛｜貢献5 信頼5 協調4 発信4｜画面デザインの雰囲気をそのままアプリにしてくれた。
学内車椅子ナビゲーションアプリ｜佐藤 澪 → 中村 蓮｜貢献3 信頼4 協調4 発信3｜システムの構造について丁寧に説明してくれた。
学内車椅子ナビゲーションアプリ｜佐藤 澪 → 松本 さくら｜貢献4 信頼4 協調4 発信3｜利用者像の具体化に大きく貢献してくれた。
学内車椅子ナビゲーションアプリ｜松本 さくら → 小林 大地｜貢献5 信頼5 協調5 発信4｜調査対象者の選定と日程調整を主導してくれた。
学内車椅子ナビゲーションアプリ｜松本 さくら → 鈴木 結愛｜貢献4 信頼4 協調4 発信4｜ミーティングを効率良く回してくれた。
学内車椅子ナビゲーションアプリ｜松本 さくら → 中村 蓮｜貢献3 信頼4 協調3 発信2｜進捗報告の頻度がもう少し多いと安心だった。
学内車椅子ナビゲーションアプリ｜松本 さくら → 佐藤 澪｜貢献4 信頼4 協調4 発信4｜試作品を見た利用者からの評判が非常に良かった。
伝統工芸デジタルアーカイブ・WEB展覧会｜佐藤 澪 → 鈴木 結愛｜貢献5 信頼5 協調4 発信4｜デザインの細部まで忠実に Web で表現してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜佐藤 澪 → 伊藤 葵｜貢献4 信頼4 協調4 発信4｜閲覧の分析ダッシュボードが見やすかった。
伝統工芸デジタルアーカイブ・WEB展覧会｜佐藤 澪 → 渡辺 航｜貢献4 信頼5 協調5 発信4｜職人さんへの丁寧な働きかけで信頼関係を築いてくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜佐藤 澪 → 松本 さくら｜貢献4 信頼4 協調4 発信3｜閲覧者アンケートの集計結果をわかりやすくまとめた。
伝統工芸デジタルアーカイブ・WEB展覧会｜鈴木 結愛 → 佐藤 澪｜貢献5 信頼5 協調5 発信4｜世界観が素晴らしい Web のグラフィックを制作した。
伝統工芸デジタルアーカイブ・WEB展覧会｜鈴木 結愛 → 伊藤 葵｜貢献3 信頼4 協調4 発信3｜アクセス解析の設定位置を的確に指示してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜鈴木 結愛 → 渡辺 航｜貢献4 信頼4 協調4 発信4｜権利関係の確認を事前に済ませてくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜鈴木 結愛 → 松本 さくら｜貢献4 信頼4 協調4 発信3｜評価コメントを分類して整理してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜伊藤 葵 → 佐藤 澪｜貢献4 信頼4 協調4 発信3｜サイトの構造がシンプルで閲覧データを追いやすかった。
伝統工芸デジタルアーカイブ・WEB展覧会｜伊藤 葵 → 鈴木 結愛｜貢献4 信頼5 協調4 発信3｜コードの品質が高くエラーがほとんどなかった。
伝統工芸デジタルアーカイブ・WEB展覧会｜伊藤 葵 → 渡辺 航｜貢献4 信頼4 協調4 発信4｜プロジェクト全体の目標を明確に示してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜伊藤 葵 → 松本 さくら｜貢献5 信頼5 協調5 発信4｜アンケートと閲覧データの突き合わせに協力してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜渡辺 航 → 佐藤 澪｜貢献5 信頼5 協調4 発信5｜工芸品の美しさを最大限に伝える表現だった。
伝統工芸デジタルアーカイブ・WEB展覧会｜渡辺 航 → 鈴木 結愛｜貢献4 信頼4 協調4 発信3｜厳しい日程の中でサイトを公開させてくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜渡辺 航 → 伊藤 葵｜貢献4 信頼4 協調4 発信3｜閲覧を増やすためのデータ分析を行ってくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜渡辺 航 → 松本 さくら｜貢献4 信頼4 協調4 発信4｜職人と閲覧者の意識の差をレポートにしてくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜松本 さくら → 佐藤 澪｜貢献5 信頼5 協調4 発信4｜利用者テストでの満足度が非常に高いデザインだった。
伝統工芸デジタルアーカイブ・WEB展覧会｜松本 さくら → 鈴木 結愛｜貢献4 信頼4 協調4 発信3｜スマホ表示の崩れを即座に修正してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜松本 さくら → 伊藤 葵｜貢献4 信頼4 協調4 発信4｜データの根拠に基づいた改善案を出してくれた。
伝統工芸デジタルアーカイブ・WEB展覧会｜松本 さくら → 渡辺 航｜貢献4 信頼5 協調5 発信4｜職人さんとの交渉を進めて調査の時間を確保してくれた。
リモート学習集中度モニタリングツール｜伊藤 葵 → 高橋 陽菜｜貢献5 信頼5 協調5 発信5｜教育の現場での有効性を学術的な視点で評価してくれた。
リモート学習集中度モニタリングツール｜伊藤 葵 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜大量の記録を処理する仕組みを組んでくれた。
リモート学習集中度モニタリングツール｜伊藤 葵 → 田中 健太｜貢献3 信頼4 協調4 発信3｜テスト受講者として素直な感想をくれた。
リモート学習集中度モニタリングツール｜高橋 陽菜 → 伊藤 葵｜貢献5 信頼5 協調4 発信4｜高度な分析モデルを教育評価に使える形にしてくれた。
リモート学習集中度モニタリングツール｜高橋 陽菜 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜記録を集めるタイミングの調整に対応してくれた。
リモート学習集中度モニタリングツール｜高橋 陽菜 → 田中 健太｜貢献4 信頼4 協調4 発信3｜実験の参加者として記録の提供に協力してくれた。
リモート学習集中度モニタリングツール｜中村 蓮 → 伊藤 葵｜貢献5 信頼5 協調4 発信4｜求めるデータの条件が明確で準備しやすかった。
リモート学習集中度モニタリングツール｜中村 蓮 → 高橋 陽菜｜貢献4 信頼4 協調5 発信4｜実験の手順をわかりやすくマニュアルにしてくれた。
リモート学習集中度モニタリングツール｜中村 蓮 → 田中 健太｜貢献3 信頼3 協調4 発信2｜実験での記録の採取に協力してくれた。
リモート学習集中度モニタリングツール｜田中 健太 → 伊藤 葵｜貢献4 信頼4 協調4 発信3｜集中度のデータが綺麗に見える形になっていて面白かった。
リモート学習集中度モニタリングツール｜田中 健太 → 高橋 陽菜｜貢献4 信頼5 協調5 発信4｜実験時の誘導や説明が丁寧で分かりやすかった。
リモート学習集中度モニタリングツール｜田中 健太 → 中村 蓮｜貢献4 信頼4 協調4 発信3｜システムのエラーなく実験を終えさせてくれた。
規格外果実の清涼飲料水商品化マーケティング｜田中 健太 → 渡辺 航｜貢献5 信頼5 協調4 発信5｜製造会社との協力の交渉を見事にまとめてくれた。
規格外果実の清涼飲料水商品化マーケティング｜田中 健太 → 松本 さくら｜貢献4 信頼4 協調5 発信4｜味の好みの調査データを的確に集計してくれた。
規格外果実の清涼飲料水商品化マーケティング｜田中 健太 → 小林 大地｜貢献4 信頼5 協調4 発信3｜表示ラベルのアレルギー表記の確認を徹底してくれた。
規格外果実の清涼飲料水商品化マーケティング｜渡辺 航 → 田中 健太｜貢献5 信頼5 協調4 発信4｜果汁の成分分析と組み合わせの提案が専門的だった。
規格外果実の清涼飲料水商品化マーケティング｜渡辺 航 → 松本 さくら｜貢献4 信頼4 協調4 発信4｜対象の層の購入意向を丁寧に調べてまとめた。
規格外果実の清涼飲料水商品化マーケティング｜渡辺 航 → 小林 大地｜貢献3 信頼4 協調4 発信3｜表示の決まりの確認を丁寧に行ってくれた。
規格外果実の清涼飲料水商品化マーケティング｜松本 さくら → 田中 健太｜貢献4 信頼5 協調4 発信3｜試作品の味の種類を豊富に準備してくれた。
規格外果実の清涼飲料水商品化マーケティング｜松本 さくら → 渡辺 航｜貢献5 信頼5 協調5 発信4｜事業計画が成り立つかの議論を引っ張ってくれた。
規格外果実の清涼飲料水商品化マーケティング｜松本 さくら → 小林 大地｜貢献4 信頼4 協調4 発信3｜配慮が必要な消費者への視点を補ってくれた。
規格外果実の清涼飲料水商品化マーケティング｜小林 大地 → 田中 健太｜貢献4 信頼4 協調4 発信3｜安全な原材料の選定に配慮してくれた。
規格外果実の清涼飲料水商品化マーケティング｜小林 大地 → 渡辺 航｜貢献4 信頼5 協調4 発信4｜プロジェクト全体の推進力が高く頼もしかった。
規格外果実の清涼飲料水商品化マーケティング｜小林 大地 → 松本 さくら｜貢献4 信頼4 協調5 発信4｜利用者調査の設問が非常に洗練されていた。
`;

// プロジェクト名とIDの対応辞書
const EVAL_PROJECT_NAME_MAP: Record<string, string> = {
  "放置竹林サステナブル照明（第1期）": "demo-completed-pj",
  "高齢者向け歩行アシストギア検証": "past-pj-walking-assist",
  "地理情報連携防災教育デジタル教材": "past-pj-disaster-edu",
  "食育体験型アグリテックイベント": "past-pj-agritech-event",
  "学内車椅子ナビゲーションアプリ": "past-pj-wheelchair-nav",
  "伝統工芸デジタルアーカイブ・WEB展覧会": "past-pj-craft-archive",
  "リモート学習集中度モニタリングツール": "past-pj-remote-study",
  "規格外果実の清涼飲料水商品化マーケティング": "past-pj-fruit-drink",
};

async function main() {
  console.log("=== HIVE デモデータ（会話30件・過去PJ7件・相互評価120件）の投入開始 ===");
  const db = getAdminDb();

  // ──────────────── 1. 会話30件の投入 ────────────────
  console.log("\n[1/4] チャット会話（30件）を投入中...");
  let chatCount = 0;
  for (const c of RAW_CHATS) {
    const projectId = PROJECT_ID_MAP[c.projectKey];
    const student = STUDENTS[c.senderName];
    if (!student) {
      console.warn(`未登録の学生名: ${c.senderName}`);
      continue;
    }

    // 日本時間文字列を Date に変換
    const dateStr = `${c.datetime.replace(" ", "T")}:00+09:00`;
    const createdAtDate = new Date(dateStr);

    // 固定の一意ID（重複排除・何度実行しても同じIDで上書き）
    const msgId = `demo_add_${projectId}_${c.datetime.replace(/[- :]/g, "")}_${student.uid}`;

    const msgRef = db.collection("ideas").doc(projectId).collection("messages").doc(msgId);
    await msgRef.set({
      roomId: "general",
      senderUid: student.uid,
      senderName: student.name,
      senderSchool: student.school,
      senderRole: "参加メンバー",
      text: c.text,
      isAnnouncement: false,
      confirmedUserUids: [],
      createdAt: createdAtDate,
    }, { merge: true });

    chatCount++;
  }
  console.log(`✓ チャット会話 ${chatCount} 件を投入完了`);

  // ──────────────── 2. 過去に終了したプロジェクト（7件）の投入 ────────────────
  console.log("\n[2/4] 過去の終了プロジェクト（7件）を投入中...");
  for (const p of PAST_PROJECTS) {
    const pjRef = db.collection("ideas").doc(p.id);

    // 進行役の学生
    const facilitator = p.members.find((m) => m.isFacilitator) || p.members[0];
    const facilitatorMeta = STUDENTS[facilitator.name];

    await pjRef.set({
      id: p.id,
      title: p.title,
      goal: p.goal,
      fields: ["地域連携", "実践開発"],
      period: p.period,
      status: "completed",
      isCompleted: true,
      isSample: true,
      rawText: `${p.title}。${p.goal}`,
      publishedAt: p.period.split("〜")[0].trim() || "2025-04-10",
      author: {
        displayName: facilitatorMeta?.name || facilitator.name,
        university: facilitatorMeta?.school || "大学",
        faculty: "学部",
        department: "学科",
        major: facilitator.role,
      },
      result: {
        title: p.title,
        goal: p.goal,
        achievements: p.achievements,
        summary: p.achievements,
      },
    }, { merge: true });

    // メンバーサブコレクションの投入 ＆ 学生の joinedProjectIds 更新
    for (const m of p.members) {
      const s = STUDENTS[m.name];
      if (!s) continue;

      // members サブコレクション
      const mRef = pjRef.collection("members").doc(s.uid);
      await mRef.set({
        userId: s.uid,
        displayName: s.name,
        schoolName: s.school,
        roleName: m.role,
        isFacilitator: m.isFacilitator,
        isOwner: m.isFacilitator,
        participationType: "membership",
        status: "active",
      }, { merge: true });

      // users コレクションの joinedProjectIds に追加
      const userRef = db.collection("users").doc(s.uid);
      await userRef.set({
        joinedProjectIds: FieldValue.arrayUnion(p.id),
      }, { merge: true });
    }
  }
  console.log(`✓ 過去プロジェクト 7 件およびメンバーを投入完了`);

  // 放置竹林サステナブル照明（第1期）のメンバーの joinedProjectIds も確認追加
  const bambooMembers = ["student-male-yamamoto", "student-male-kobayashi", "student-female-sato", "student-male-watanabe"];
  for (const uid of bambooMembers) {
    await db.collection("users").doc(uid).set({
      joinedProjectIds: FieldValue.arrayUnion("demo-completed-pj"),
    }, { merge: true });
  }

  // ──────────────── 3. 相互評価（120件）の投入 ────────────────
  console.log("\n[3/4] 相互評価（120件）を投入中...");
  const lines = RAW_EVAL_TEXT.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  let evalCount = 0;

  for (const line of lines) {
    // 例: プロジェクト名｜評価した人 → 評価された人｜貢献4 信頼5 協調5 発信4｜コメント
    const parts = line.split("｜");
    if (parts.length < 4) continue;

    const pjName = parts[0].trim();
    const [fromName, toName] = parts[1].split("→").map((s) => s.trim());
    const scoreStr = parts[2].trim();
    const comment = parts[3].trim();

    const projectId = EVAL_PROJECT_NAME_MAP[pjName];
    const fromStudent = STUDENTS[fromName];
    const toStudent = STUDENTS[toName];

    if (!projectId || !fromStudent || !toStudent) {
      console.warn(`マッチ失敗: ${pjName} / ${fromName} -> ${toName}`);
      continue;
    }

    // スコアの抽出（貢献4 信頼5 協調5 発信4）
    const matchContrib = scoreStr.match(/貢献(\d)/);
    const matchTrust = scoreStr.match(/信頼(\d)/);
    const matchCoop = scoreStr.match(/協調(\d)/);
    const matchShare = scoreStr.match(/発信(\d)/);

    const scores = {
      contribution: matchContrib ? parseInt(matchContrib[1], 10) : 4,
      trust: matchTrust ? parseInt(matchTrust[1], 10) : 4,
      cooperation: matchCoop ? parseInt(matchCoop[1], 10) : 4,
      sharing: matchShare ? parseInt(matchShare[1], 10) : 4,
    };

    // ドキュメントID: プロジェクトID_評価した人のuid_評価された人のuid
    const evalDocId = `${projectId}_${fromStudent.uid}_${toStudent.uid}`;
    const evalRef = db.collection("evaluations").doc(evalDocId);

    await evalRef.set({
      projectId,
      projectTitle: pjName,
      fromUid: fromStudent.uid,
      fromName: fromStudent.name,
      toUid: toStudent.uid,
      toName: toStudent.name,
      scores,
      comment,
      createdAt: new Date("2026-11-01T12:00:00+09:00"),
      updatedAt: new Date("2026-11-01T12:00:00+09:00"),
    }, { merge: true });

    evalCount++;
  }
  console.log(`✓ 相互評価 ${evalCount} 件を投入完了`);

  // ──────────────── 4. 学生10人の評価件数と全体平均星の集計 ────────────────
  console.log("\n[4/4] 学生10人の相互評価集計レポートを生成中...");
  console.log("--------------------------------------------------------------------------------");
  console.log("| 学生名       | UID                       | 評価件数 | 総合平均星 (1〜5) | 貢献 | 信頼 | 協調 | 発信 |");
  console.log("--------------------------------------------------------------------------------");

  for (const s of Object.values(STUDENTS)) {
    const snap = await db.collection("evaluations").where("toUid", "==", s.uid).get();
    if (snap.empty) {
      console.log(`| ${s.name.padEnd(8, "　")} | ${s.uid.padEnd(25)} | 0件      | なし              | -    | -    | -    | -    |`);
      continue;
    }

    let sumOverall = 0;
    let sumContrib = 0;
    let sumTrust = 0;
    let sumCoop = 0;
    let sumShare = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const sc = data.scores || {};
      const c = Number(sc.contribution) || 3;
      const t = Number(sc.trust) || 3;
      const co = Number(sc.cooperation) || 3;
      const sh = Number(sc.sharing) || 3;

      sumContrib += c;
      sumTrust += t;
      sumCoop += co;
      sumShare += sh;

      const avg = (c + t + co + sh) / 4;
      sumOverall += avg;
    });

    const count = snap.size;
    const avgOverall = (Math.round((sumOverall / count) * 10) / 10).toFixed(1);
    const avgContrib = (Math.round((sumContrib / count) * 10) / 10).toFixed(1);
    const avgTrust = (Math.round((sumTrust / count) * 10) / 10).toFixed(1);
    const avgCoop = (Math.round((sumCoop / count) * 10) / 10).toFixed(1);
    const avgShare = (Math.round((sumShare / count) * 10) / 10).toFixed(1);

    console.log(
      `| ${s.name.padEnd(6, "　")} | ${s.uid.padEnd(25)} | ${String(count).padStart(2)}件     | ★ ${avgOverall.padStart(3)}          | ${avgContrib}  | ${avgTrust}  | ${avgCoop}  | ${avgShare}  |`
    );

    // users コレクションの rank.breakdown および evaluationsCount も最新値に同期更新
    await db.collection("users").doc(s.uid).set({
      rank: {
        title: Number(avgOverall) >= 4.5 ? "三段" : Number(avgOverall) >= 4.0 ? "二段" : "初段",
        evaluationsCount: count,
        breakdown: {
          contribution: Number(avgContrib),
          trust: Number(avgTrust),
          cooperation: Number(avgCoop),
          sharing: Number(avgShare),
        },
      },
    }, { merge: true });
  }
  console.log("--------------------------------------------------------------------------------");
  console.log("=== デモデータ投入完了 ===");
}

main().catch((err) => {
  console.error("投入エラー:", err);
  process.exit(1);
});
