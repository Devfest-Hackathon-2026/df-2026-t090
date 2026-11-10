import { getAdminDb, FieldValue } from "../src/lib/firebase-admin";

/**
 * ハッカソン審査用デモプロジェクトデータ投入スクリプト
 * - 3つのプロジェクト（地域伝統クラフトビール開発、学内空き教室リアルタイム共有、放置竹林サステナブル照明）
 * - 各プロジェクトのメンバー4名
 * - 日本時間固定の日時を持つ発言履歴
 * - 進み具合（段階ごとの状態）と isSample: true
 */

interface DemoMember {
  userId: string;
  displayName: string;
  schoolName: string;
  roleName: string;
  isOwner: boolean;
  isFacilitator: boolean;
  participationType: "job" | "membership";
  status: "active" | "leaving" | "離脱中";
  leavingDate?: string;
}

interface DemoMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderSchool: string;
  senderRole: string;
  text: string;
  isAnnouncement: boolean;
  deadline?: string;
  confirmedUserUids: string[];
  createdAtJST: string; // "YYYY-MM-DD HH:mm"
}

interface DemoProject {
  id: string;
  aliasId?: string; // 終了プロジェクト等で2つのIDに対応
  title: string;
  goal: string;
  status: "in_progress" | "completed";
  isCompleted: boolean;
  isSample: true;
  stages: Array<{ name: string; status: "completed" | "in_progress" | "not_started"; statusLabel: string }>;
  progressSummaryText: string;
  members: DemoMember[];
  messages: DemoMessage[];
}

const DEMO_PROJECTS: DemoProject[] = [
  // ─── 1. 地域伝統クラフトビール開発（進行中） ───
  {
    id: "demo-idea-craft-beer",
    title: "地域伝統クラフトビール開発",
    goal: "地元の農産物の香りを生かしたクラフトビールを、醸造免許を持つ地元の醸造所と共同で試作し、地域イベントでの試飲提供と事業化の計画をまとめる。",
    status: "in_progress",
    isCompleted: false,
    isSample: true,
    stages: [
      { name: "コンセプトの決定と利用者の調査", status: "completed", statusLabel: "完了" },
      { name: "醸造所との試作レシピの調整と試醸", status: "in_progress", statusLabel: "進行中" },
      { name: "ラベルデザインの決定と試飲イベントの企画", status: "not_started", statusLabel: "未着手" },
    ],
    progressSummaryText: "コンセプトの決定と利用者の調査【完了】／醸造所との試作レシピの調整と試醸【進行中】／ラベルデザインの決定と試飲イベントの企画【未着手】",
    members: [
      {
        userId: "student-male-watanabe",
        displayName: "渡辺 航",
        schoolName: "一橋大学 商学部",
        roleName: "進行役・ビジネス",
        isOwner: false,
        isFacilitator: true,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-male-tanaka",
        displayName: "田中 健太",
        schoolName: "東京農工大学 農学部",
        roleName: "発酵・醸造",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "離脱中",
        leavingDate: "2026年11月12日に復帰予定",
      },
      {
        userId: "student-female-sato",
        displayName: "佐藤 澪",
        schoolName: "武蔵野美術大学 造形構想学部",
        roleName: "デザイン",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-female-matsumoto",
        displayName: "松本 さくら",
        schoolName: "東京大学 文学部",
        roleName: "リサーチ",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
    ],
    messages: [
      {
        id: "msg-beer-01",
        senderUid: "student-male-watanabe",
        senderName: "渡辺 航",
        senderSchool: "一橋大学 商学部",
        senderRole: "進行役・ビジネス",
        text: "みなさん、プロジェクト開始です。まずは地元の特産品を使ったクラフトビールのコンセプト決めと、醸造のパートナー探しから進めましょう。酒税法上、私たちが直接醸造することはできないので、醸造免許を持つ地元の醸造所と共同で試作する形を取ります。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-05 10:00",
      },
      {
        id: "msg-beer-02",
        senderUid: "student-female-matsumoto",
        senderName: "松本 さくら",
        senderSchool: "東京大学 文学部",
        senderRole: "リサーチ",
        text: "地域の受け入れられ方と対象の層について、調査結果をまとめました。地元産の果実やハーブの香りがほんのりする、飲みやすいエールを求める声が多かったです。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-08 14:30",
      },
      {
        id: "msg-beer-03",
        senderUid: "student-female-sato",
        senderName: "佐藤 澪",
        senderSchool: "武蔵野美術大学 造形構想学部",
        senderRole: "デザイン",
        text: "松本さんの調査をもとに、瓶と缶の両方に使えるラベルの初期案を作りました。地域の伝統模様をモチーフにしています。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-12 11:15",
      },
      {
        id: "msg-beer-04",
        senderUid: "student-male-watanabe",
        senderName: "渡辺 航",
        senderSchool: "一橋大学 商学部",
        senderRole: "進行役・ビジネス",
        text: "地元の醸造所から、共同試作に協力していただけることになりました。ここからは田中さんに、醸造の仕様の調整を中心に進めてもらいます。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-20 16:00",
      },
      {
        id: "msg-beer-05",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "醸造所の担当者と打ち合わせをして、第一弾の試作レシピ（ペールエールをもとに、地元産の柑橘の皮を使う）の設計に入りました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-25 09:30",
      },
      {
        id: "msg-beer-06",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "使うホップの種類と、柑橘の皮を入れるタイミングを麦汁を煮る工程の終わる直前にすることが決まりました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-02 13:00",
      },
      {
        id: "msg-beer-07",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "醸造所の仕込み設備をお借りして、第1ロットの仕込み（仕込み水・麦芽の粉砕・糖化）に立ち会いました。今は主発酵の段階です。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-09 17:45",
      },
      {
        id: "msg-beer-08",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "10月下旬から大学の学外実習に入るため、約3週間プロジェクトを一時的に離れます。引継ぎ事項を整理します。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-15 10:20",
      },
      {
        id: "msg-beer-09",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "第1ロットの比重の測定データと発酵温度の記録は、共有フォルダの「試醸管理」にすべて保存しました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-20 15:00",
      },
      {
        id: "msg-beer-10",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "離れている間の主な作業は、瓶詰め後の熟成の確認です。11月5日に醸造所での瓶詰めの立ち会いが必要です。渡辺さん、代わりに立ち会いをお願いできますか。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-23 11:00",
      },
      {
        id: "msg-beer-11",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "11月5日の立ち会いは渡辺さんにお願いし、醸造所の担当者にも連絡して了承をもらいました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-25 14:10",
      },
      {
        id: "msg-beer-12",
        senderUid: "student-male-tanaka",
        senderName: "田中 健太",
        senderSchool: "東京農工大学 農学部",
        senderRole: "発酵・醸造",
        text: "試飲の評価シートの入力締め切りは11月15日です。私は11月12日に戻る予定なので、戻りしだい味のデータの分析と、第2ロットの調整案づくりに入ります。よろしくお願いします。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-27 18:30",
      },
      {
        id: "msg-beer-13",
        senderUid: "student-male-watanabe",
        senderName: "渡辺 航",
        senderSchool: "一橋大学 商学部",
        senderRole: "進行役・ビジネス",
        text: "田中さんの指示のとおり、今日醸造所で第1ロットの瓶詰めに立ち会いました。仕上がりは良好です。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-11-05 16:30",
      },
      {
        id: "msg-beer-14",
        senderUid: "student-male-watanabe",
        senderName: "渡辺 航",
        senderSchool: "一橋大学 商学部",
        senderRole: "進行役・ビジネス",
        text: "11月20日の地域の秋季成果発表会に向けて、発表スライドの下書きを11月13日（金）23:59までに共有フォルダへ上げてください。11月18日に全体リハーサルを行います。",
        isAnnouncement: true,
        deadline: "2026-11-13",
        confirmedUserUids: ["student-female-sato", "student-female-matsumoto"],
        createdAtJST: "2026-11-08 09:00",
      },
    ],
  },

  // ─── 2. 学内空き教室リアルタイム共有（進行中） ───
  {
    id: "demo-idea-campus-map",
    title: "学内空き教室リアルタイム共有",
    goal: "キャンパス内の空き教室や自習スペースの使われ方をリアルタイムで見えるようにし、学生が学習スペースを見つけやすくする Web アプリを作る。",
    status: "in_progress",
    isCompleted: false,
    isSample: true,
    stages: [
      { name: "要件定義と画面設計", status: "completed", statusLabel: "完了" },
      { name: "データベースの設計と API の実装", status: "in_progress", statusLabel: "進行中" },
      { name: "学内での実証テストと導入", status: "not_started", statusLabel: "未着手" },
    ],
    progressSummaryText: "要件定義と画面設計【完了】／データベースの設計と API の実装【進行中】／学内での実証テストと導入【未着手】",
    members: [
      {
        userId: "student-female-suzuki",
        displayName: "鈴木 結愛",
        schoolName: "早稲田大学 基幹理工学部",
        roleName: "進行役・フロントエンド",
        isOwner: false,
        isFacilitator: true,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-male-nakamura",
        displayName: "中村 蓮",
        schoolName: "東京工業高等専門学校 情報工学科",
        roleName: "バックエンド",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-female-ito",
        displayName: "伊藤 葵",
        schoolName: "京都大学 理学部",
        roleName: "データサイエンス",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-female-takahashi",
        displayName: "高橋 陽菜",
        schoolName: "東京学芸大学 教育学部",
        roleName: "エデュケーター",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
    ],
    messages: [
      {
        id: "msg-campus-01",
        senderUid: "student-female-suzuki",
        senderName: "鈴木 結愛",
        senderSchool: "早稲田大学 基幹理工学部",
        senderRole: "進行役・フロントエンド",
        text: "学内空き教室リアルタイム共有アプリの開発を始めます。まずは全体のシステム構成と、画面のワイヤーフレームづくりから進めましょう。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-02 13:00",
      },
      {
        id: "msg-campus-02",
        senderUid: "student-female-suzuki",
        senderName: "鈴木 結愛",
        senderSchool: "早稲田大学 基幹理工学部",
        senderRole: "進行役・フロントエンド",
        text: "画面の遷移図を更新しました。ダッシュボードからワンタップで空き席の数を確認できるようにしています。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-10 15:20",
      },
      {
        id: "msg-campus-03",
        senderUid: "student-male-nakamura",
        senderName: "中村 蓮",
        senderSchool: "東京工業高等専門学校 情報工学科",
        senderRole: "バックエンド",
        text: "バックエンドの API 仕様書を作りました。各教室のセンサーのデータと、学内の予約システムとの連携の窓口を定義しています。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-18 11:00",
      },
      {
        id: "msg-campus-04",
        senderUid: "student-female-ito",
        senderName: "伊藤 葵",
        senderSchool: "京都大学 理学部",
        senderRole: "データサイエンス",
        text: "曜日と時間帯ごとの教室の混み具合を予測するモデルの試作を作りました。過去の利用の傾向をもとにしています。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-28 14:15",
      },
      {
        id: "msg-campus-05",
        senderUid: "student-male-nakamura",
        senderName: "中村 蓮",
        senderSchool: "東京工業高等専門学校 情報工学科",
        senderRole: "バックエンド",
        text: "データベースの負荷テストをしています。リアルタイム更新の遅れは、今のところ問題ない範囲です。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-12 16:50",
      },
      {
        id: "msg-campus-06",
        senderUid: "student-female-suzuki",
        senderName: "鈴木 結愛",
        senderSchool: "早稲田大学 基幹理工学部",
        senderRole: "進行役・フロントエンド",
        text: "β版のフロントエンドとバックエンドをつないだテストが終わりました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-11-02 10:00",
      },
    ],
  },

  // ─── 3. 放置竹林サステナブル照明（第1期）（終了） ───
  {
    id: "demo-completed-pj",
    aliasId: "demo-idea-bamboo-lamp",
    title: "放置竹林サステナブル照明 (第1期)",
    goal: "放置竹林の竹を再利用し、安全で誰でも扱いやすい竹製の LED 照明の試作品を作り、展示で評価してもらう。",
    status: "completed",
    isCompleted: true,
    isSample: true,
    stages: [
      { name: "竹の調達・加工方法と構造の設計", status: "completed", statusLabel: "完了" },
      { name: "回路の設計・加工・使いやすさの評価", status: "completed", statusLabel: "完了" },
      { name: "試作品の完成と展示での意見集め", status: "completed", statusLabel: "完了" },
    ],
    progressSummaryText: "竹の調達・加工方法と構造の設計【完了】／回路の設計・加工・使いやすさの評価【完了】／試作品の完成と展示での意見集め【完了】",
    members: [
      {
        userId: "student-male-yamamoto",
        displayName: "山本 翔太",
        schoolName: "東京工業大学 工学院",
        roleName: "進行役・ハードウェア",
        isOwner: false,
        isFacilitator: true,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-male-kobayashi",
        displayName: "小林 大地",
        schoolName: "慶應義塾大学 看護医療学部",
        roleName: "アクセシビリティ",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-female-sato",
        displayName: "佐藤 澪",
        schoolName: "武蔵野美術大学 造形構想学部",
        roleName: "デザイン",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
      {
        userId: "student-male-watanabe",
        displayName: "渡辺 航",
        schoolName: "一橋大学 商学部",
        roleName: "ビジネス",
        isOwner: false,
        isFacilitator: false,
        participationType: "membership",
        status: "active",
      },
    ],
    messages: [
      {
        id: "msg-bamboo-01",
        senderUid: "student-male-yamamoto",
        senderName: "山本 翔太",
        senderSchool: "東京工業大学 工学院",
        senderRole: "進行役・ハードウェア",
        text: "「放置竹林サステナブル照明（第1期）」を始めます。竹林の保全とインテリア照明を組み合わせた製品の完成を目指します。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-01 09:00",
      },
      {
        id: "msg-bamboo-02",
        senderUid: "student-female-sato",
        senderName: "佐藤 澪",
        senderSchool: "武蔵野美術大学 造形構想学部",
        senderRole: "デザイン",
        text: "竹の節や質感を生かしたシェードのデザイン案を3つ作りました。自然光のような温かい光の広がりを目指します。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-07 14:00",
      },
      {
        id: "msg-bamboo-03",
        senderUid: "student-male-yamamoto",
        senderName: "山本 翔太",
        senderSchool: "東京工業大学 工学院",
        senderRole: "進行役・ハードウェア",
        text: "乾燥させた竹の切削加工と、中に入れる省電力の LED 基板と電源回路の設計が終わりました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-15 11:30",
      },
      {
        id: "msg-bamboo-04",
        senderUid: "student-male-kobayashi",
        senderName: "小林 大地",
        senderSchool: "慶應義塾大学 看護医療学部",
        senderRole: "アクセシビリティ",
        text: "高齢の方や手の力が弱い方でも安全にスイッチを操作できるか、スイッチの形と置いたときの安定性を確かめました。オンとオフの操作をしやすくする改善案を出しました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-22 16:00",
      },
      {
        id: "msg-bamboo-05",
        senderUid: "student-male-watanabe",
        senderName: "渡辺 航",
        senderSchool: "一橋大学 商学部",
        senderRole: "ビジネス",
        text: "竹の調達の費用と、量産したときの販売価格の見込みをまとめました。売上の一部を竹林の整備に回す形が成り立ちそうです。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-09-30 13:20",
      },
      {
        id: "msg-bamboo-06",
        senderUid: "student-male-yamamoto",
        senderName: "山本 翔太",
        senderSchool: "東京工業大学 工学院",
        senderRole: "進行役・ハードウェア",
        text: "小林さんの意見を取り入れたスイッチ部分と LED 回路を組み込み、試作品が完成しました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-10 15:00",
      },
      {
        id: "msg-bamboo-07",
        senderUid: "student-female-sato",
        senderName: "佐藤 澪",
        senderSchool: "武蔵野美術大学 造形構想学部",
        senderRole: "デザイン",
        text: "学内のデザインギャラリーで展示しました。来場者から、竹の風合いと光の広がりがよいという感想をいただきました。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-20 17:00",
      },
      {
        id: "msg-bamboo-08",
        senderUid: "student-male-yamamoto",
        senderName: "山本 翔太",
        senderSchool: "東京工業大学 工学院",
        senderRole: "進行役・ハードウェア",
        text: "評価の集計と成果報告書の作成が終わりました。「放置竹林サステナブル照明（第1期）」は全段階を完了とし、これで終了します。みなさん、お疲れさまでした。",
        isAnnouncement: false,
        confirmedUserUids: [],
        createdAtJST: "2026-10-31 18:00",
      },
    ],
  },
];

/**
 * 日本時間文字列 "YYYY-MM-DD HH:mm" を UTC Date オブジェクトに変換
 */
function jstToTimestamp(jstStr: string): Date {
  const [datePart, timePart] = jstStr.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  // JST は UTC+9 なので 9 時間引いて UTC Date を作成
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0));
}

async function seedDemoProjects() {
  console.log("🚀 デモ用サンプルプロジェクトデータの投入を開始します...\n");
  const db = getAdminDb();

  for (const pj of DEMO_PROJECTS) {
    const targetProjectIds = pj.aliasId ? [pj.id, pj.aliasId] : [pj.id];

    for (const pId of targetProjectIds) {
      console.log(`📁 プロジェクト「${pj.title}」(${pId}) を更新中...`);

      // 1. プロジェクト本体の更新（ゴール、進み具合、isSample: true）
      const pDocRef = db.collection("ideas").doc(pId);
      await pDocRef.set(
        {
          title: pj.title,
          goal: pj.goal,
          status: pj.status,
          isCompleted: pj.isCompleted,
          isSample: true,
          stages: pj.stages,
          progressSummaryText: pj.progressSummaryText,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2. メンバーの更新（指定の4名のみ、それ以外のサンプル学生は外す。ただしログイン中stromain等の運営アカウントは保持）
      const membersColl = pDocRef.collection("members");
      const existingMembersSnap = await membersColl.get();
      const validUserIds = new Set(pj.members.map((m) => m.userId));

      for (const mDoc of existingMembersSnap.docs) {
        // stromain または運営アカウントは保持
        if (mDoc.id.includes("stromain") || mDoc.data().isOwner) {
          continue;
        }
        if (!validUserIds.has(mDoc.id)) {
          console.log(`   ✕ 余剰サンプルメンバー削除: ${mDoc.id} (${mDoc.data().displayName})`);
          await mDoc.ref.delete();
        }
      }

      for (const member of pj.members) {
        await membersColl.doc(member.userId).set({
          userId: member.userId,
          displayName: member.displayName,
          schoolName: member.schoolName,
          roleName: member.roleName,
          isOwner: member.isOwner,
          isFacilitator: member.isFacilitator,
          participationType: member.participationType,
          status: member.status,
          leavingDate: member.leavingDate || null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`   ✓ メンバー: ${member.displayName} (${member.roleName}) - ${member.status}`);
      }

      // 3. 発言（メッセージ）の更新（指定日時の固定値で投入）
      const messagesColl = pDocRef.collection("messages");
      for (const msg of pj.messages) {
        const msgTimestamp = jstToTimestamp(msg.createdAtJST);
        await messagesColl.doc(msg.id).set({
          roomId: "general",
          senderUid: msg.senderUid,
          senderName: msg.senderName,
          senderSchool: msg.senderSchool,
          senderRole: msg.senderRole,
          text: msg.text,
          isAnnouncement: msg.isAnnouncement,
          deadline: msg.deadline || null,
          confirmedUserUids: msg.confirmedUserUids,
          createdAt: msgTimestamp,
        });
        console.log(`   💬 発言 [${msg.createdAtJST}]: ${msg.senderName} - ${msg.text.slice(0, 25)}...`);
      }
      console.log("");
    }
  }

  console.log("🎉 デモ用サンプルデータの投入がすべて完了しました！");
}

seedDemoProjects().catch((err) => {
  console.error("❌ エラー発生:", err);
  process.exit(1);
});
