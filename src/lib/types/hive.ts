/**
 * HIVE 全データモデル型定義
 */

// 利用者の種類と権限
export type UserRole = "student" | "admin";
export type UserStatus = "active" | "suspended";

// ランク内訳（各5点満点）
export interface RankBreakdown {
  contribution: number; // 貢献
  trust: number;        // 信頼
  cooperation: number;  // 協調
  sharing: number;      // 発信
}

export interface UserRank {
  title: string;       // 例: "初段", "二段", "三段"
  breakdown: RankBreakdown;
  evaluationsCount: number; // 相互評価の件数
}

// 時間割・空き時間（月〜金、1〜5限 + 夜間など）
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type TimeSlot = 1 | 2 | 3 | 4 | 5 | 6; // 時限

export interface TimetableSlot {
  day: DayOfWeek;
  slot: TimeSlot;
  isAvailable: boolean; // 空きかどうか
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  roles: UserRole[];   // ["student"] または ["student", "admin"]
  status: UserStatus;
  schoolId: string;    // 学校ID
  schoolName: string;  // 学校名（大学・高専）
  faculty: string;     // 学部
  department: string;  // 学科
  grade: string;       // 学年（例: "学部3年", "高専4年", "修士1年"）
  major: string;       // 専攻・専門
  mainRole: string;    // メインの役職
  subRoles: string[];  // その他の役職
  rank: UserRank;
  timetable: TimetableSlot[];
  googleCalendarSynced: boolean;
  connections: {
    collaboratorsCount: number; // 一緒に活動した人数
    schoolsCount: number;       // 一緒に活動した学校数
    primaryPartners: Array<{
      uid: string;
      displayName: string;
      schoolName: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

// 学校マスター（A07）
export type SchoolType = "university" | "kosen" | "other";

export interface SchoolMaster {
  id: string;
  name: string;
  type: SchoolType;
  prefecture: string;
  registeredUsersCount: number;
  createdAt: string;
  updatedAt: string;
}

// 学校追加依頼（学生からの依頼）
export type SchoolRequestStatus = "pending" | "merged" | "added" | "rejected";

export interface SchoolRequest {
  id: string;
  requestedName: string;
  requesterUids: string[];
  requestCount: number;
  status: SchoolRequestStatus;
  resolvedSchoolId?: string;
  resolvedAt?: string;
  createdAt: string;
}

// スキル分野（A07）
export interface SkillCategory {
  id: string;
  name: string; // 初期値: "生命科学", "情報", "語学・試験", "経験"
  order: number;
  createdAt: string;
}

// スキルのレベル方式
export type SkillLevelType = "level" | "score" | "period" | "none";
export type SkillStatus = "active" | "disabled"; // スキルは消せない（削除不可ルール）

export interface SkillMaster {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  aliases: string[]; // 検索で拾うための別名
  levelType: SkillLevelType;
  hasLevels: boolean; // Lv1〜3を付けるかどうか
  requiredEvidencePrompt: string; // 審査に要る根拠の説明
  status: SkillStatus; // 使用中／選べない
  holdersCount: number; // 持っている人数
  createdAt: string;
  updatedAt: string;
}

// 学生の枝（スキルツリー上のスキル枝 W03）
export type SkillBranchStatus = "verified" | "pending" | "next"; // 審査済み / 審査中 / 次に伸ばせる枝
export type SkillEvidenceType = "lecture" | "exam_qualification" | "experience" | "portfolio";

export interface SkillEvidence {
  evidenceType: SkillEvidenceType;
  description: string;
  fileUrls: string[];
  links: string[];
}

export interface UserSkillBranch {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName: string;
  status: SkillBranchStatus;
  level?: number;       // 1 | 2 | 3
  score?: string;       // 例: TOEIC 850点
  period?: string;      // 例: 1.5年
  evidence: SkillEvidence;
  submittedAt: string;
  reviewedAt?: string;
  reviewerUid?: string;
  reviewerComment?: string; // 学生への一言（ツリーの根拠として本人に見える）
  rejectionReason?: string; // 差し戻し理由（根拠の追加をお願いする等）
}

// 操作の記録（A09: 追記のみ、全運営操作）
export type AuditActionType =
  | "skill_review"       // スキル審査（A02）
  | "project_review"     // プロジェクト公開審査（A03）
  | "record_cert"        // 活動記録認定（A04）
  | "report_action"      // 通報対応（A05）
  | "user_role_change"   // 運営の印の付け外し（A06）
  | "user_suspend"       // 利用一時停止（A05/A06）
  | "master_skill_edit"  // スキル一覧編集（A07）
  | "master_school_edit" // 学校一覧編集（A07）
  | "announcement_post"; // お知らせ配信（A08）

export interface AuditLog {
  id: string;
  timestamp: string;      // ISO形式日時 (JST表記用)
  adminUid: string;       // 操作した運営のUID
  adminName: string;      // 運営者の名前
  adminEmail: string;     // 運営者のメール
  actionType: AuditActionType;
  actionDetail: string;   // 何をしたか（例: "田中健太の運営権限を付与"）
  targetType: string;     // 対象の種類（例: "user", "skill", "project"）
  targetId: string;       // 対象ID
  targetName?: string;    // 対象名
  reasonAndNotes: string; // 理由・メモ（必須または推奨）
}

// 2人確認（仮）用の保留アクション
export type PendingConfirmationType = "user_suspend" | "broadcast_announcement";
export type PendingConfirmationStatus = "pending" | "approved" | "rejected";

export interface PendingConfirmation {
  id: string;
  actionType: PendingConfirmationType;
  initiatedByUid: string;
  initiatedByName: string;
  initiatedAt: string;
  payload: Record<string, unknown>;
  reason: string;
  status: PendingConfirmationStatus;
  confirmedByUid?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  confirmationNote?: string;
}

// 応募（W02 応募受付 & W04 届いた応募）
export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface ProjectApplication {
  id: string;
  projectId: string;
  projectTitle: string;
  projectOwnerUid: string;
  roleId: string;
  roleName: string;
  applicantUid: string;
  applicantName: string;
  applicantSchool: string;
  applicantFaculty?: string;
  applicantGrade?: string;
  motivationMessage: string; // 応募動機・メッセージ
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
}

// プロジェクト参加メンバー（W09 メンバーと役割）
export type MemberParticipationType = "job" | "membership";
export type MemberStatus = "active" | "leaving";

export interface ProjectMember {
  userId: string;
  displayName: string;
  schoolName: string;
  roleName: string;
  isOwner: boolean;
  isFacilitator: boolean; // 進行役
  participationType: MemberParticipationType;
  status: MemberStatus;
  joinedAt: string;
  leavingDate?: string;
}

// チャットメッセージ ＆ 全体連絡（W06 チャット）
export interface ProjectMessage {
  id: string;
  projectId: string;
  roomId: string;          // "general" または タスクID
  senderUid: string;
  senderName: string;
  senderSchool: string;
  senderRole: string;
  text: string;
  isAnnouncement: boolean; // 進行役が出す「全体連絡」かどうか
  deadline?: string;       // 全体連絡の確認期限（例: "2026-11-12 23:59"）
  confirmedUserUids: string[]; // 「確認しました」を押したメンバーのUID配列
  totalMembersCount?: number;  // 確認対象人数（例: 6人中3人）
  createdAt: string;
}

// チャットルーム
export interface ChatRoom {
  id: string;
  name: string;
  type: "general" | "task";
  unreadCount: number;
  hasUnconfirmedAnnouncement: boolean; // 未確認の全体連絡があるか
}

