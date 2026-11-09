/**
 * HIVE デザインシステム設定（仕様書「8. デザインの方針」準拠）
 * 
 * はちみつ・蜂の巣・色鉛筆の手描き質感をモチーフとし、
 * アクセシビリティ基準（コントラスト比4.5:1以上、タップ領域44px以上）を担保したデザイン設定。
 */

export const HIVE_THEME = {
  // カラーパレット
  colors: {
    // はちみつ基本色
    honey: {
      light: "#FFF8E1",    // 明るい巣蜜色（背景・カード）
      warm: "#FFF2BE",     // 暖かいはちみつ色
      primary: "#F5B301",  // 鮮やかな熟成はちみつ色（メインアクション、ボタン）
      deep: "#E0A200",     // 濃い琥珀色（ホバー、アクセント）
      amber: "#B87503",    // 琥珀色（見出し、ボーダー）
    },
    // テキスト・基調色（背景に対して4.5:1以上のコントラストを担保）
    text: {
      primary: "#3D2406",  // 濃厚な木製・ハニーブラウン（本文・見出し）- 非常に高いコントラスト
      secondary: "#5C3D15",// 落ち着いたハニーブラウン（副テキスト）
      muted: "#7A5726",    // 補足・注記
      inverse: "#FFFFFF",  // 反転白文字
    },
    // 背景色（紙の質感を感じる生成り・アイボリー調）
    background: {
      canvas: "#FFFDF7",   // アプリ全体の背景（上質な画用紙の質感）
      card: "#FFFBEB",     // カード背景
      cardHighlight: "#FFF4CA", // 強調カード背景
      sidebar: "#FBF5E5",  // 左メニュー背景
    },
    // 状態色（色鉛筆調の自然な色合い）
    status: {
      success: {
        bg: "#EDF7ED",
        border: "#81C784",
        text: "#1E4620",
        label: "認定・審査済み",
      },
      warning: {
        bg: "#FFF8E1",
        border: "#FFB74D",
        text: "#663C00",
        label: "審査中・対応中",
      },
      danger: {
        bg: "#FDEAEA",
        border: "#E57373",
        text: "#5F1313",
        label: "差し戻し・停止",
      },
      info: {
        bg: "#EBF3FC",
        border: "#64B5F6",
        text: "#0D3C61",
        label: "次に伸ばせる枝",
      },
    },
  },

  // 色鉛筆風の手描き質感クラス・SVGスタイル
  styles: {
    // タッチ領域（44px四方以上）を担保するユーティリティクラス
    touchTarget: "min-h-[44px] min-w-[44px] flex items-center justify-center",

    // 色鉛筆風のかすれた輪郭・手描き風ボーダー
    pencilBorder: "border border-[#B87503]/40 shadow-[1px_2px_0px_rgba(184,117,3,0.15)]",
    pencilBorderThick: "border-2 border-[#B87503]/60 shadow-[2px_3px_0px_rgba(184,117,3,0.2)]",

    // 手描き感のある角丸
    organicCard: "rounded-[1.25rem] bg-[#FFFBEB]/90 backdrop-blur-sm",

    // ハニカム六角形のクリップパス（CSS clip-path）
    hexagonClip: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  },
} as const;

/**
 * 日本時間（JST）かつ24時間表記でフォーマットするユーティリティ
 */
export function formatJSTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "-";
  }
}

export function formatJSTDateOnly(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "-";
  }
}
