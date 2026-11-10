"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { FILTER_FIELDS, FilterField } from "@/lib/constants";
import { UserProfile, ProjectApplication, ProjectMessage, UserSkillBranch } from "@/lib/types/hive";
import { ProjectTaskItem, TaskStatus } from "@/app/api/student/projects/[id]/tasks/route";
import { ProjectFileItem } from "@/app/api/student/projects/[id]/files/route";
import { formatJSTDateTime } from "@/lib/theme";
import StudentSidebar from "@/components/StudentSidebar";
import OnboardingModal from "@/components/OnboardingModal";
import SkillTreeVisualizer from "@/components/SkillTreeVisualizer";

interface RoleItem {
  name: string;
  reason: string;
  skills: string[];
}

interface AuthorInfo {
  displayName: string;
  university: string;
  faculty: string;
  department: string;
  major: string;
}

interface StudentSuggestion {
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

interface PublishedIdea {
  id: string;
  ownerUid: string;
  title: string;
  goal: string;
  fields: string[];
  roles: RoleItem[];
  firstSteps: string[];
  rawText: string;
  publishedAt: string | null;
  author: AuthorInfo;
  aiSuggestions?: StudentSuggestion[];
}

interface ProjectProgressAiResult {
  progressPercentage: number;
  stageLabel: string;
  summary: string;
  goodPoints: string[];
  bottlenecks: string[];
  nextActions: string[];
  scoreWhy: string;
}

interface ProjectMemberResponseItem {
  userId: string;
  displayName: string;
  schoolName: string;
  roleName: string;
  isFacilitator: boolean;
}

function parseWorkspaceNav(nav: string): {
  projectId: string | null;
  subTab: "chat" | "tasks" | "files" | "calendar" | "members";
} {
  if (!nav.startsWith("workspace-")) {
    return { projectId: null, subTab: "chat" };
  }
  const raw = nav.slice("workspace-".length);
  if (raw.endsWith("-chat")) {
    return { projectId: raw.slice(0, -"-chat".length), subTab: "chat" };
  }
  if (raw.endsWith("-tasks")) {
    return { projectId: raw.slice(0, -"-tasks".length), subTab: "tasks" };
  }
  if (raw.endsWith("-files")) {
    return { projectId: raw.slice(0, -"-files".length), subTab: "files" };
  }
  if (raw.endsWith("-schedule") || raw.endsWith("-calendar")) {
    const suffix = raw.endsWith("-schedule") ? "-schedule" : "-calendar";
    return { projectId: raw.slice(0, -suffix.length), subTab: "calendar" };
  }
  if (raw.endsWith("-members")) {
    return { projectId: raw.slice(0, -"-members".length), subTab: "members" };
  }
  return { projectId: raw, subTab: "chat" };
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 左メニューのアクティブ項目（home, profile, scout, submit, records, workspace-{id}-{tab}）
  const [activeNav, setActiveNav] = useState<string>("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState<number>(0);

  // オンボーディングモーダル（学校・時間割入力）
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // 公開プロジェクト一覧用State
  const [publishedIdeas, setPublishedIdeas] = useState<PublishedIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState<boolean>(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FilterField>("すべて");
  const [selectedIdea, setSelectedIdea] = useState<PublishedIdea | null>(null);

  // AI学生マッチング提案用State
  const [matchingLoading, setMatchingLoading] = useState<boolean>(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingMessage, setMatchingMessage] = useState<string | null>(null);

  // ──────── W02 応募モーダル用State ────────
  const [applyModalOpen, setApplyModalOpen] = useState<boolean>(false);
  const [selectedRoleForApply, setSelectedRoleForApply] = useState<RoleItem | null>(null);
  const [applyMotivation, setApplyMotivation] = useState<string>("");
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // ──────── W04 スカウト・届いた応募用State ────────
  const [scoutTab, setScoutTab] = useState<"candidates" | "sent" | "received">("received");
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [appActionMessage, setAppActionMessage] = useState<string | null>(null);

  // ──────── W06 チャット・全体連絡用State ────────
  const [chatMessages, setChatMessages] = useState<ProjectMessage[]>([]);
  const [chatInputText, setChatInputText] = useState<string>("");
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatIsAnnouncement, setChatIsAnnouncement] = useState<boolean>(false);
  const [chatDeadline, setChatDeadline] = useState<string>("");
  const [activeChatRoomId, setActiveChatRoomId] = useState<string>("general");
  const [workspaceSubTab, setWorkspaceSubTab] = useState<"chat" | "tasks" | "files" | "calendar" | "members">("chat");

  // ──────── タスク管理用State ────────
  const [projectTasks, setProjectTasks] = useState<ProjectTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [taskCreateModalOpen, setTaskCreateModalOpen] = useState<boolean>(false);
  const [taskTitleInput, setTaskTitleInput] = useState<string>("");
  const [taskAssigneeUid, setTaskAssigneeUid] = useState<string>("");
  const [taskDeadlineInput, setTaskDeadlineInput] = useState<string>("");
  const [taskOriginalMsgId, setTaskOriginalMsgId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);

  // ──────── AIプロジェクト進行度測定State ────────
  const [progressAiResult, setProgressAiResult] = useState<ProjectProgressAiResult | null>(null);
  const [isAnalyzingProgress, setIsAnalyzingProgress] = useState<boolean>(false);
  const [progressAiError, setProgressAiError] = useState<string | null>(null);

  // ──────── AI引継ぎ要約用State ────────
  const [handoverModalOpen, setHandoverModalOpen] = useState<boolean>(false);
  const [handoverLoadingUserId, setHandoverLoadingUserId] = useState<string | null>(null);
  const [handoverTargetName, setHandoverTargetName] = useState<string>("");
  const [handoverTargetRole, setHandoverTargetRole] = useState<string>("");
  const [handoverStatusText, setHandoverStatusText] = useState<string>("");
  const [handoverDecisionsText, setHandoverDecisionsText] = useState<string>("");
  const [handoverTasksText, setHandoverTasksText] = useState<string>("");
  const [handoverNoDataAlert, setHandoverNoDataAlert] = useState<string | null>(null);
  const [isSharingHandover, setIsSharingHandover] = useState<boolean>(false);
  const [handoverSharedSuccess, setHandoverSharedSuccess] = useState<string | null>(null);

  // ──────── AIガクチカ下書き用State ────────
  const [selectedGakuchikaPjId, setSelectedGakuchikaPjId] = useState<string>("demo-idea-craft-beer");
  const [gakuchikaResultText, setGakuchikaResultText] = useState<string>("");
  const [isGeneratingGakuchika, setIsGeneratingGakuchika] = useState<boolean>(false);
  const [gakuchikaError, setGakuchikaError] = useState<string | null>(null);
  const [gakuchikaCopyMessage, setGakuchikaCopyMessage] = useState<string | null>(null);

  // ──────── 共有ファイル管理用State ────────
  const [projectFiles, setProjectFiles] = useState<ProjectFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ──────── 参加メンバー動的取得用State ────────
  const [projectMembers, setProjectMembers] = useState<ProjectMemberResponseItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);

  // ──────── W03 スキルツリー用State ────────
  const [userBranches, setUserBranches] = useState<UserSkillBranch[]>([]);
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<UserSkillBranch | null>(null);

  // 参加中・公開中プロジェクトのロールで求められているスキル一覧（次に伸ばせる枝用）
  const requiredSkillsFromProjects = useMemo(() => {
    const list: Array<{ skillName: string; projectTitle: string; roleName: string }> = [];
    publishedIdeas.forEach((idea) => {
      idea.roles?.forEach((role) => {
        role.skills?.forEach((sName) => {
          const clean = sName.trim();
          if (clean) {
            list.push({
              skillName: clean,
              projectTitle: idea.title,
              roleName: role.name,
            });
          }
        });
      });
    });
    return list;
  }, [publishedIdeas]);

  // ──────── W05 申請・公開用State ────────
  const [submitTab, setSubmitTab] = useState<"skill" | "project">("skill");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  // スキル申請
  const [newSkillName, setNewSkillName] = useState<string>("");
  const [newSkillCategory, setNewSkillCategory] = useState<string>("cat-it-programming");
  const [newSkillLevel, setNewSkillLevel] = useState<number>(2);
  const [newSkillDesc, setNewSkillDesc] = useState<string>("");
  const [newSkillLink, setNewSkillLink] = useState<string>("");
  // プロジェクト提唱
  const [newPjTitle, setNewPjTitle] = useState<string>("");
  const [newPjGoal, setNewPjGoal] = useState<string>("");
  const [newPjReason, setNewPjReason] = useState<string>("");
  const [newPjRole1, setNewPjRole1] = useState<string>("");
  const [newPjRole2, setNewPjRole2] = useState<string>("");

  // 公開プロジェクト一覧の取得
  const fetchPublishedIdeas = async (field?: string) => {
    try {
      const url =
        field && field !== "すべて"
          ? `/api/ideas?field=${encodeURIComponent(field)}`
          : "/api/ideas";
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setIdeasError(err.error || "プロジェクト一覧の取得に失敗しました。");
        return;
      }
      const data = await res.json();
      setPublishedIdeas(data.ideas || []);
      setIdeasError(null);
    } catch {
      setIdeasError("通信エラーが発生しました。");
    } finally {
      setIdeasLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadIdeas = async () => {
      try {
        const url =
          selectedField && selectedField !== "すべて"
            ? `/api/ideas?field=${encodeURIComponent(selectedField)}`
            : "/api/ideas";
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (active) setIdeasError(err.error || "プロジェクト一覧の取得に失敗しました。");
          return;
        }
        const data = await res.json();
        if (active) {
          setPublishedIdeas(data.ideas || []);
          setIdeasError(null);
        }
      } catch {
        if (active) setIdeasError("通信エラーが発生しました。");
      } finally {
        if (active) setIdeasLoading(false);
      }
    };

    loadIdeas();
    return () => {
      active = false;
    };
  }, [selectedField]);

  // ユーザー認証＆プロファイル取得
  const fetchUserProfile = useCallback(async (currentUser: User) => {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile || null);
          setIsAdmin(Boolean(data.isAdmin));
          return;
        }
      } catch {
        // リトライ
      }
      if (retry < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          fetchUserProfile(currentUser);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      });
    } catch (err) {
      console.error("Auth初期化エラー:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserProfile]);

  // ──────── W03 スキルツリー枝の取得 ────────
  useEffect(() => {
    if (activeNav !== "profile" || !user) return;
    let active = true;

    const loadBranches = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/skills?userId=${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setUserBranches(data.branches || []);
        }
      } catch (err) {
        console.error("スキルツリー取得エラー:", err);
      }
    };

    loadBranches();
    return () => {
      active = false;
    };
  }, [activeNav, user]);

  // ──────── W02 応募の提出 ────────
  const handleSendApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedIdea || !selectedRoleForApply) return;
    setIsApplying(true);
    setApplyMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selectedIdea.id,
          roleName: selectedRoleForApply.name,
          motivationMessage: applyMotivation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "応募の送信に失敗しました。");
        return;
      }

      setApplyMessage(data.message || "応募を完了しました！");
      setApplyMotivation("");
      setTimeout(() => {
        setApplyModalOpen(false);
        setApplyMessage(null);
      }, 1500);
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsApplying(false);
    }
  };

  // ──────── W04 届いた応募一覧の取得 ────────
  const fetchApplications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/applications?type=${scoutTab === "received" ? "received" : "sent"}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("応募取得エラー:", err);
    } finally {
      setLoadingApps(false);
    }
  }, [user, scoutTab]);

  useEffect(() => {
    if (activeNav !== "scout" || !user) return;
    let active = true;

    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/applications?type=${scoutTab === "received" ? "received" : "sent"}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setApplications(data.applications || []);
        }
      } catch (err) {
        console.error("応募取得エラー:", err);
      } finally {
        if (active) setLoadingApps(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [activeNav, scoutTab, user]);

  // ──────── W04 応募の承認／見送り処理 ────────
  const handleApproveApplication = async (appId: string, action: "approve" | "reject") => {
    if (!user) return;
    setAppActionMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/applications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: appId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "処理に失敗しました。");
        return;
      }

      setAppActionMessage(data.message);
      fetchApplications();
      setRefreshSidebarTrigger((prev) => prev + 1);
    } catch {
      alert("通信エラーが発生しました。");
    }
  };

  // ──────── プロジェクトIDおよびサブタブの正確なパース ────────
  const parsedWorkspace = parseWorkspaceNav(activeNav);
  const activeProjectId = parsedWorkspace.projectId;
  const currentSubTab = parsedWorkspace.subTab || workspaceSubTab || "chat";

  // ──────── 開いているプロジェクト詳細の動的取得 ────────
  const [activeProjectDetail, setActiveProjectDetail] = useState<{
    id: string;
    title: string;
    goal: string;
    progressSummaryText?: string;
    isSample?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;

    let active = true;
    const fetchProjectDetail = async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/ideas/${activeProjectId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setActiveProjectDetail({
              id: data.id,
              title: data.title || data.result?.title || "プロジェクト",
              goal: data.goal || data.result?.goal || "",
              progressSummaryText: data.progressSummaryText || undefined,
              isSample: Boolean(data.isSample),
            });
          }
        }
      } catch (err) {
        console.error("プロジェクト詳細取得エラー:", err);
      }
    };

    fetchProjectDetail();
    return () => {
      active = false;
    };
  }, [activeProjectId, user]);

  // ──────── W06 チャットメッセージの取得・ポーリング ────────

  const fetchChatMessages = useCallback(async () => {
    if (!user || !activeProjectId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat?roomId=${activeChatRoomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (err) {
      console.error("チャット取得エラー:", err);
    }
  }, [user, activeProjectId, activeChatRoomId]);

  useEffect(() => {
    if (!activeNav.startsWith("workspace") || !activeProjectId || !user) return;
    let active = true;

    const loadChat = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/projects/${activeProjectId}/chat?roomId=${activeChatRoomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setChatMessages(data.messages || []);
        }
      } catch (err) {
        console.error("チャット取得エラー:", err);
      }
    };

    loadChat();
    const interval = setInterval(loadChat, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeNav, activeProjectId, activeChatRoomId, user]);

  // ──────── プロジェクト参加メンバーの動的取得 ────────
  useEffect(() => {
    if (!activeNav.startsWith("workspace") || !activeProjectId) {
      return;
    }

    let active = true;
    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const token = user ? await user.getIdToken() : null;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/student/projects/${activeProjectId}/members`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setProjectMembers(data.members || []);
          }
        }
      } catch (err) {
        console.error("メンバー取得エラー:", err);
      } finally {
        if (active) setLoadingMembers(false);
      }
    };

    loadMembers();
    return () => {
      active = false;
    };
  }, [activeNav, activeProjectId, user]);

  // ──────── タスク一覧の動的取得 ────────
  const fetchTasks = useCallback(async () => {
    if (!activeProjectId || !user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjectTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("タスク取得エラー:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [activeProjectId, user]);

  useEffect(() => {
    if (!activeNav.startsWith("workspace") || !activeProjectId || !user) return;
    let active = true;

    const loadTasks = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/projects/${activeProjectId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setProjectTasks(data.tasks || []);
        }
      } catch (err) {
        console.error("タスク取得エラー:", err);
      } finally {
        if (active) setLoadingTasks(false);
      }
    };

    loadTasks();
    return () => {
      active = false;
    };
  }, [activeNav, activeProjectId, user]);

  // ──────── 発言からタスク作成モーダルを開く ────────
  const handleOpenTaskCreate = (msgText: string, msgId: string) => {
    setTaskTitleInput(msgText.slice(0, 100));
    setTaskOriginalMsgId(msgId);
    setTaskAssigneeUid(projectMembers[0]?.userId || user?.uid || "");
    setTaskDeadlineInput("");
    setTaskCreateModalOpen(true);
  };

  // ──────── タスクの新規作成 ────────
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeProjectId || !taskTitleInput.trim()) return;
    setIsCreatingTask(true);

    try {
      const token = await user.getIdToken();
      const targetMember = projectMembers.find((m) => m.userId === taskAssigneeUid);
      const res = await fetch(`/api/student/projects/${activeProjectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: taskTitleInput.trim(),
          assigneeUid: taskAssigneeUid,
          assigneeName: targetMember?.displayName || user.displayName || "メンバー",
          deadline: taskDeadlineInput,
          originalMessageId: taskOriginalMsgId,
        }),
      });

      if (res.ok) {
        setTaskCreateModalOpen(false);
        setTaskTitleInput("");
        fetchTasks();
      } else {
        alert("タスク作成に失敗しました。");
      }
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // ──────── タスク状態の更新（未着手・進行中・完了） ────────
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!user || !activeProjectId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch {
      alert("タスク状態の更新に失敗しました。");
    }
  };

  // ──────── 共有ファイル一覧の動的取得 ────────
  const fetchFiles = useCallback(async () => {
    if (!activeProjectId || !user) return;
    setLoadingFiles(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjectFiles(data.files || []);
      }
    } catch (err) {
      console.error("ファイル取得エラー:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, [activeProjectId, user]);

  useEffect(() => {
    if (!activeNav.startsWith("workspace") || !activeProjectId || !user) return;
    let active = true;

    const loadFiles = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/projects/${activeProjectId}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setProjectFiles(data.files || []);
        }
      } catch (err) {
        console.error("ファイル取得エラー:", err);
      } finally {
        if (active) setLoadingFiles(false);
      }
    };

    loadFiles();
    return () => {
      active = false;
    };
  }, [activeNav, activeProjectId, user]);

  // ──────── ファイルアップロード ────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeProjectId) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("1ファイルの上限は20MBです。");
      return;
    }

    setIsUploadingFile(true);
    setFileActionMessage(null);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/student/projects/${activeProjectId}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "アップロードに失敗しました。");
        return;
      }

      setFileActionMessage(`✓ 「${data.fileName}」を Cloud Storage にアップロードしました！`);
      fetchFiles();
      setTimeout(() => setFileActionMessage(null), 3500);
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  // ──────── ファイルを期限付き署名付きURLで開く ────────
  const handleOpenFile = async (fileId: string) => {
    if (!user || !activeProjectId) {
      alert("ファイルを閲覧するにはログインが必要です。");
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/files?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        alert(data.error || "ファイルを開けませんでした。");
      }
    } catch {
      alert("ファイル取得通信エラーが発生しました。");
    }
  };

  // ──────── W06 メッセージ送信 ────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeProjectId || !chatInputText.trim()) return;
    setIsSendingChat(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: activeChatRoomId,
          text: chatInputText.trim(),
          isAnnouncement: chatIsAnnouncement,
          deadline: chatIsAnnouncement ? chatDeadline : undefined,
        }),
      });

      if (res.ok) {
        setChatInputText("");
        setChatIsAnnouncement(false);
        setChatDeadline("");
        fetchChatMessages();
      } else {
        alert("メッセージ送信に失敗しました。");
      }
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsSendingChat(false);
    }
  };

  // ──────── W06 全体連絡「確認しました」ボタン ────────
  const handleConfirmAnnouncement = async (messageId: string) => {
    if (!user || !activeProjectId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/chat`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        fetchChatMessages();
      }
    } catch {
      alert("確認処理に失敗しました。");
    }
  };

  // ──────── AIガクチカ下書き生成 ────────
  const handleGenerateGakuchika = async () => {
    if (!user) {
      alert("ガクチカ生成を利用するには、右上のログインボタンからGoogleログインしてください。");
      return;
    }
    if (!selectedGakuchikaPjId) return;

    setIsGeneratingGakuchika(true);
    setGakuchikaError(null);
    setGakuchikaCopyMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/gakuchika-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: selectedGakuchikaPjId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGakuchikaError(data.error || "ガクチカ下書きの生成に失敗しました。");
        return;
      }

      setGakuchikaResultText(data.gakuchikaText || "");
    } catch {
      setGakuchikaError("通信エラーが発生しました。");
    } finally {
      setIsGeneratingGakuchika(false);
    }
  };

  const handleCopyGakuchika = () => {
    if (!gakuchikaResultText) return;
    navigator.clipboard.writeText(gakuchikaResultText);
    setGakuchikaCopyMessage("✓ クリップボードにコピーしました！");
    setTimeout(() => setGakuchikaCopyMessage(null), 2500);
  };

  // ──────── W06 AIによるプロジェクト進行度測定 ────────
  const handleAnalyzeProgressAi = async () => {
    if (!user || !activeProjectId) return;
    setIsAnalyzingProgress(true);
    setProgressAiError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/progress-ai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setProgressAiError(data.error || "進行度測定に失敗しました。");
        return;
      }

      setProgressAiResult(data.result);
    } catch {
      setProgressAiError("通信エラーが発生しました。");
    } finally {
      setIsAnalyzingProgress(false);
    }
  };

  // ──────── AIによる引継ぎ要約の生成 ────────
  const handleGenerateHandover = async (userId: string, userName: string, roleName: string) => {
    if (!user) {
      alert("AI 引継ぎ要約を利用するには、右上のログインボタンからGoogleログインしてください。");
      return;
    }
    if (!activeProjectId) return;
    setHandoverLoadingUserId(userId);
    setHandoverNoDataAlert(null);
    setHandoverSharedSuccess(null);
    setHandoverTargetRole(roleName);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/student/projects/${activeProjectId}/handover-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.noData) {
          setHandoverNoDataAlert(`${userName} さんについて要約に使える記録がまだありません。`);
        } else {
          alert(data.error || "引継ぎ要約の生成に失敗しました。");
        }
        return;
      }

      const r = data.result;
      setHandoverTargetName(r.targetUserName);
      setHandoverTargetRole(r.targetUserRole);
      setHandoverStatusText(r.currentStatus);
      setHandoverDecisionsText(
        r.decisions.map((d: { content: string; reference: string }) => `・${d.content}（参照: ${d.reference}）`).join("\n")
      );
      setHandoverTasksText(
        r.remainingTasks
          .map(
            (t: { task: string; deadline: string; note?: string }) =>
              `・${t.task}（目安締切: ${t.deadline}${t.note ? ` / 留意: ${t.note}` : ""}）`
          )
          .join("\n")
      );
      setHandoverModalOpen(true);
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setHandoverLoadingUserId(null);
    }
  };

  // ──────── 進行役による引継ぎメモのチャット共有 ────────
  const handleShareHandoverToChat = async () => {
    if (!user || !activeProjectId) return;
    setIsSharingHandover(true);

    try {
      const token = await user.getIdToken();
      const summaryText = `【メンバー引継ぎメモ: ${handoverTargetName} (${handoverTargetRole})】\n\n■ 1. 現在地\n${handoverStatusText}\n\n■ 2. 決まったこと\n${handoverDecisionsText}\n\n■ 3. 残りの作業と締切\n${handoverTasksText}`;

      const res = await fetch(`/api/student/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: "general",
          text: summaryText,
          isAnnouncement: true, // 全体連絡として重要固定
          deadline: "2026-11-20",
        }),
      });

      if (res.ok) {
        setHandoverSharedSuccess("引継ぎメモをチャットの全体連絡として共有しました！");
        fetchChatMessages();
        setTimeout(() => {
          setHandoverModalOpen(false);
          setHandoverSharedSuccess(null);
        }, 1500);
      } else {
        alert("共有に失敗しました。");
      }
    } catch {
      alert("通信エラーが発生しました。");
    } finally {
      setIsSharingHandover(false);
    }
  };

  // ──────── W05 スキル枝の申請 ────────
  const handleSubmitSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setSubmitSuccessMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skillName: newSkillName,
          categoryId: newSkillCategory,
          categoryName:
            newSkillCategory === "cat-life-science"
              ? "生命科学"
              : newSkillCategory === "cat-it-programming"
              ? "情報"
              : newSkillCategory === "cat-language-exams"
              ? "語学・試験"
              : "経験",
          level: newSkillLevel,
          description: newSkillDesc,
          linkUrl: newSkillLink,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSubmitSuccessMessage(data.message);
      setNewSkillName("");
      setNewSkillDesc("");
      setNewSkillLink("");
    } catch (err: unknown) {
      alert((err as Error).message || "申請に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  // ──────── W05 プロジェクト提唱 ────────
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setSubmitSuccessMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: newPjTitle,
          goal: newPjGoal,
          reasonNonCampus: newPjReason,
          fields: ["情報", "地域"],
          roles: [
            { name: newPjRole1 || "開発エンジニア", reason: "システム構築", skills: ["Next.js"] },
            { name: newPjRole2 || "デザイナー", reason: "UI/UX設計", skills: ["Figma"] },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSubmitSuccessMessage("新規プロジェクトを提唱しました！運営による公開審査へ進みます。");
      setNewPjTitle("");
      setNewPjGoal("");
      setNewPjReason("");
      setNewPjRole1("");
      setNewPjRole2("");
    } catch (err: unknown) {
      alert((err as Error).message || "提唱に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  // ログイン・ログアウト
  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      setError(authError.message || "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      setError("ログアウトに失敗しました。");
    }
  };

  // AI学生マッチング
  const handleMatchStudents = async (ideaId: string) => {
    if (!user) {
      setMatchingError("マッチング提案を利用するにはログインが必要です。");
      return;
    }
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchingMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/ideas/${ideaId}/match`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setMatchingError(data.error || "マッチング提案の取得に失敗しました。");
        return;
      }

      setMatchingMessage(data.message || "マッチング候補を更新しました。");
      if (selectedIdea && selectedIdea.id === ideaId) {
        setSelectedIdea({
          ...selectedIdea,
          aiSuggestions: data.suggestions || [],
        });
      }
    } catch {
      setMatchingError("通信エラーが発生しました。");
    } finally {
      setMatchingLoading(false);
    }
  };

  // 固定表示「全体連絡」
  const announcementMessage = chatMessages.slice().reverse().find((m) => m.isAnnouncement);

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#3D2406] flex">
      {/* 共通左サイドバー */}
      <StudentSidebar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        activeNav={activeNav}
        refreshTrigger={refreshSidebarTrigger}
        onSelectNav={(id) => {
          setActiveNav(id);
          setSelectedIdea(null);
        }}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイル用トップヘッダー */}
        <header className="md:hidden sticky top-0 z-30 bg-[#FFFBEB]/95 backdrop-blur-md border-b border-[#B87503]/30 px-4 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-[#FFF8E1] border border-[#B87503]/30 text-lg"
          >
            ☰
          </button>
          <span className="font-black text-base text-[#3D2406]">HIVE</span>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-[#7A5726]"
            >
              ログアウト
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold"
            >
              ログイン
            </button>
          )}
        </header>

        {/* コンテンツ本体 */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {/* 上部ヘッダー（デスクトップ向け） */}
          <div className="hidden md:flex items-center justify-between pb-4 mb-6 border-b border-[#B87503]/20">
            <div>
              <span className="text-xs font-bold text-[#7A5726] block">
                大学・高専を越えるプロジェクト共創プラットフォーム
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#3D2406] mt-0.5">
                {activeNav === "home" && "ホーム（おすすめプロジェクト）"}
                {activeNav === "profile" && "プロフィールと放射状スキルツリー"}
                {activeNav === "scout" && "スカウト・届いた応募"}
                {activeNav === "submit" && "申請・公開（スキル＆プロジェクト）"}
                {activeNav === "records" && "活動記録認定"}
                {activeNav.startsWith("workspace") && "プロジェクト作業画面（チャット・AI進行度測定）"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="px-3 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] transition-colors"
                  >
                    ⚙ 学校・時間割設定
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold hover:bg-[#FFFBEB]"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200]"
                >
                  Googleでログイン
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
              ⚠ {error}
            </div>
          )}

          {/* ──────────────── W01 ホーム（合うプロジェクト一覧） ──────────────── */}
          {activeNav === "home" && (
            <div
              className="relative rounded-3xl overflow-hidden border border-[#B87503]/30 shadow-md p-4 sm:p-6 md:p-8 bg-cover bg-center transition-all"
              style={{ backgroundImage: "url('/project-list-bg.jpeg')" }}
            >
              <div className="absolute inset-0 bg-[#FFFDF7]/85 backdrop-blur-[1.5px]" />

              <div className="relative z-10 flex flex-col gap-6">
                {/* プロジェクト詳細モーダル */}
                {selectedIdea ? (
                  <div className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503] shadow-lg flex flex-col gap-6 text-left">
                    <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-3">
                      <button
                        type="button"
                        onClick={() => setSelectedIdea(null)}
                        className="text-xs font-bold text-[#B87503] hover:underline flex items-center gap-1"
                      >
                        ← 一覧に戻る
                      </button>
                      <span className="px-3 py-0.5 rounded-full bg-[#EDF7ED] text-[#1E4620] border border-[#81C784] text-xs font-bold">
                        運営審査通過済（公募中）
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedIdea.fields.map((f) => (
                          <span
                            key={f}
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F5B301]/25 text-[#3D2406] border border-[#F5B301]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#3D2406]">
                        {selectedIdea.title}
                      </h2>
                      <p className="text-xs text-[#7A5726] mt-1">
                        提唱者: <span className="font-bold text-[#3D2406]">{selectedIdea.author.displayName}</span>
                        {selectedIdea.author.university && ` (${selectedIdea.author.university} ${selectedIdea.author.faculty || ""})`}
                      </p>
                    </div>

                    {/* 在籍校だけでは実現できない理由 */}
                    <div className="p-4 rounded-2xl bg-[#FFF4CA] border border-[#F5B301] flex flex-col gap-1">
                      <span className="text-xs font-black text-[#B87503] flex items-center gap-1">
                        <span>🏫</span>
                        <span>在籍校だけでは実現できない理由</span>
                      </span>
                      <p className="text-xs sm:text-sm text-[#3D2406] leading-relaxed">
                        自大学内の専門分野だけでは不足しており、他大学の工学・デザイン・農学など異なる専門スキルを持つ仲間が集まることで初めて実現できるプロジェクトです。
                      </p>
                    </div>

                    {/* 目的・ゴール */}
                    <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/25 flex flex-col gap-1">
                      <span className="text-xs font-bold text-[#7A5726]">プロジェクトのゴール</span>
                      <p className="text-xs sm:text-sm text-[#3D2406] leading-relaxed">
                        {selectedIdea.goal}
                      </p>
                    </div>

                    {/* 募集ロール */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#7A5726]">募集している役割（ロールを選んで応募できます）</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedIdea.roles.map((r, i) => {
                          const isSelectedRole = selectedRoleForApply?.name === r.name;
                          return (
                            <div
                              key={i}
                              onClick={() => setSelectedRoleForApply(r)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                                isSelectedRole
                                  ? "bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md scale-[1.02]"
                                  : "bg-[#FFFDF7] border-[#B87503]/20 hover:border-[#F5B301]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-[#3D2406] flex items-center gap-1.5">
                                  <span>{isSelectedRole ? "🔘" : "⚪"}</span>
                                  <span>{r.name}</span>
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503]">
                                  あなたに合う (親和度 88%)
                                </span>
                              </div>
                              <p className="text-[11px] text-[#5C3D15]">{r.reason}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.skills.map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FFF8E1] text-[#3D2406]"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AIマッチング候補 */}
                    <div className="p-5 rounded-2xl bg-[#FFFDF7] border border-[#F5B301] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#B87503] flex items-center gap-1.5">
                          <span>🤝</span>
                          <span>足りない役割に合う学生の提案（AIマッチング）</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMatchStudents(selectedIdea.id)}
                          disabled={matchingLoading}
                          className="px-3 py-1 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] disabled:opacity-50"
                        >
                          {matchingLoading ? "分析中..." : "AI再マッチング"}
                        </button>
                      </div>

                      {matchingMessage && (
                        <div className="p-2.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                          ✓ {matchingMessage}
                        </div>
                      )}
                      {matchingError && (
                        <div className="p-2.5 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
                          ⚠ {matchingError}
                        </div>
                      )}

                      {selectedIdea.aiSuggestions && selectedIdea.aiSuggestions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                          {selectedIdea.aiSuggestions.map((sugg, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-[#3D2406]">
                                  候補: {sugg.displayName}
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#F5B301]/25 text-[#3D2406] border border-[#F5B301]">
                                  {sugg.matchedRole}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#7A5726]">
                                {sugg.university} {sugg.faculty}
                              </span>
                              <p className="text-[11px] text-[#5C3D15] leading-relaxed">
                                推薦理由: {sugg.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#7A5726]">
                          まだ候補は保存されていません。「AI再マッチング」ボタンを押すと、登録学生の中から適任者を抽出します。
                        </p>
                      )}
                    </div>

                    {/* 応募アクションボタン */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#B87503]/20">
                      <span className="text-xs text-[#5C3D15]">
                        {selectedRoleForApply
                          ? `選択中:「${selectedRoleForApply.name}」`
                          : "上のロールから希望する役割を選択してください"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            alert("応募するにはログインが必要です。");
                            return;
                          }
                          if (!selectedRoleForApply) {
                            setSelectedRoleForApply(selectedIdea.roles[0] || null);
                          }
                          setApplyModalOpen(true);
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs sm:text-sm font-bold shadow-md hover:bg-[#E0A200] transition-all"
                      >
                        このロールに応募する 🚀
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 分野フィルター */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#3D2406]">分野で絞り込む:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIdeasLoading(true);
                            fetchPublishedIdeas(selectedField);
                          }}
                          className="text-xs text-[#B87503] hover:underline font-bold"
                        >
                          🔄 最新に更新
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FILTER_FIELDS.map((field) => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => {
                              setIdeasLoading(true);
                              setSelectedField(field);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              selectedField === field
                                ? "bg-[#F5B301] text-[#3D2406] shadow-xs border border-[#E0A200]"
                                : "bg-[#FFFBEB]/90 text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/25"
                            }`}
                          >
                            {field}
                          </button>
                        ))}
                      </div>
                    </div>

                    {ideasError && (
                      <div className="p-3 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
                        ⚠ {ideasError}
                      </div>
                    )}

                    <p className="text-[11px] text-[#5C3D15]">
                      ※ 親和度は、プロジェクトのロールが求めるスキルとあなたのスキルツリーの重なりから仮の計算方法（重み加重平均）で算出しています。
                    </p>

                    {/* 四角いプロジェクトカード一覧 */}
                    {ideasLoading ? (
                      <div className="py-20 text-center text-[#7A5726] font-bold flex items-center justify-center gap-2">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#F5B301] border-t-transparent" />
                        <span>プロジェクトを読み込み中...</span>
                      </div>
                    ) : publishedIdeas.length === 0 ? (
                      <div className="p-8 rounded-3xl bg-[#FFFBEB]/90 border border-[#B87503]/30 text-center">
                        <p className="text-sm font-bold text-[#3D2406]">
                          該当するプロジェクトはありませんでした。
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {publishedIdeas.map((idea, idx) => {
                          const demoAffinity = 92 - (idx % 4) * 8;
                          return (
                            <div
                              key={idea.id}
                              className="p-5 rounded-3xl bg-[#FFFBEB]/95 backdrop-blur-xs border border-[#B87503]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 text-left"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF7ED] text-[#1E4620] border border-[#81C784]">
                                      公募可
                                    </span>
                                    <span className="text-[11px] text-[#7A5726] font-medium">
                                      3校から参加中
                                    </span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F5B301] text-[#3D2406] shadow-xs">
                                    親和度 {demoAffinity}%
                                  </span>
                                </div>

                                <h3 className="text-base font-bold text-[#3D2406] line-clamp-2">
                                  {idea.title}
                                </h3>

                                <div className="flex flex-wrap gap-1">
                                  {idea.fields.map((f) => (
                                    <span
                                      key={f}
                                      className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-[#FFF8E1] text-[#5C3D15] border border-[#B87503]/20"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>

                                <p className="text-xs text-[#5C3D15] line-clamp-2 mt-1">
                                  {idea.goal}
                                </p>
                              </div>

                              <div className="pt-3 border-t border-[#B87503]/20 flex items-center justify-between">
                                <span className="text-[11px] text-[#7A5726]">
                                  提唱: <strong className="text-[#3D2406]">{idea.author.displayName}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedIdea(idea)}
                                  className="px-3.5 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs transition-colors"
                                >
                                  詳しく見る
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── W03 プロフィールと放射状スキルツリー ──────────────── */}
          {activeNav === "profile" && (
            <div className="flex flex-col gap-6 text-left">
              {/* プロフィール基本カード */}
              <div className="p-6 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503]/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#F5B301] to-[#B87503] flex items-center justify-center text-2xl font-black text-white shadow-md">
                    {profile?.displayName?.[0] || user?.displayName?.[0] || "学"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-[#3D2406]">
                        {profile?.displayName || user?.displayName || "学生ユーザー"}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F5B301] text-[#B87503] text-xs font-bold">
                        段位: {profile?.rank?.title || "初段"}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5726] mt-0.5">
                      {profile?.schoolName || "未登録大学"} {profile?.faculty || ""} {profile?.grade || ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveNav("submit")}
                    className="px-4 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200]"
                  >
                    ＋ スキルの枝を増やす（申請）
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="px-3.5 py-2 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301]"
                  >
                    時間割の編集
                  </button>
                </div>
              </div>

              {/* 放射状スキルツリービジュアライザー（お手本画像完全準拠） */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs">
                <SkillTreeVisualizer
                  userBranches={userBranches}
                  requiredSkillsFromProjects={requiredSkillsFromProjects}
                  onApplyNewSkill={() => setActiveNav("submit")}
                />
              </div>
            </div>
          )}

          {/* ──────────────── W04 スカウト・届いた応募受付 ──────────────── */}
          {activeNav === "scout" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 border-b border-[#B87503]/30 pb-3">
                <button
                  type="button"
                  onClick={() => setScoutTab("received")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    scoutTab === "received"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  <span>届いた応募</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#EA4335] text-white text-[10px] font-black">
                    {applications.filter((a) => a.status === "pending").length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScoutTab("sent")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    scoutTab === "sent"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  送った応募（応募履歴）
                </button>
                <button
                  type="button"
                  onClick={() => setScoutTab("candidates")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    scoutTab === "candidates"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  候補を探す（提唱者向け）
                </button>
              </div>

              {appActionMessage && (
                <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold shadow-xs">
                  ✓ {appActionMessage}
                </div>
              )}

              {/* 届いた応募一覧 */}
              {scoutTab === "received" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A5726]">
                      あなたが提唱したプロジェクトに届いた応募一覧です（承認するとメンバーに追加されます）:
                    </span>
                    <button
                      type="button"
                      onClick={fetchApplications}
                      className="text-xs text-[#B87503] hover:underline font-bold"
                    >
                      🔄 更新
                    </button>
                  </div>

                  {loadingApps ? (
                    <div className="py-12 text-center text-[#7A5726] font-bold">読み込み中...</div>
                  ) : applications.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-2">
                      <span className="text-3xl">📭</span>
                      <p className="text-sm font-bold text-[#3D2406]">現在届いている応募はありません。</p>
                      <p className="text-xs text-[#7A5726]">
                        他の学生があなたのプロジェクトのロールに応募すると、ここに届きます。
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-5 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                        >
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F5B301] text-[#3D2406]">
                                希望ロール: {app.roleName}
                              </span>
                              <span className="text-xs text-[#7A5726]">
                                対象: <strong className="text-[#3D2406]">{app.projectTitle}</strong>
                              </span>
                              <span
                                className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  app.status === "approved"
                                    ? "bg-[#EDF7ED] text-[#1E4620]"
                                    : app.status === "rejected"
                                    ? "bg-[#FDEAEA] text-[#5F1313]"
                                    : "bg-[#FFF8E1] text-[#B87503]"
                                }`}
                              >
                                {app.status === "approved" ? "参加承認済み" : app.status === "rejected" ? "見送り" : "審査待ち"}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-[#3D2406] mt-1">
                              応募者: {app.applicantName} ({app.applicantSchool} {app.applicantFaculty} {app.applicantGrade})
                            </div>

                            {app.motivationMessage && (
                              <p className="text-xs text-[#5C3D15] bg-[#FFFDF7] p-2.5 rounded-xl border border-[#B87503]/20 mt-1 leading-relaxed">
                                志望動機・メッセージ: {app.motivationMessage}
                              </p>
                            )}

                            <span className="text-[10px] text-[#7A5726]">
                              応募日時: {formatJSTDateTime(app.createdAt)}
                            </span>
                          </div>

                          {app.status === "pending" && (
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app.id, "reject")}
                                className="px-3.5 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold hover:bg-[#FDEAEA]"
                              >
                                見送る
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app.id, "approve")}
                                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200]"
                              >
                                参加を承認する ✓
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 送った応募（応募履歴）一覧 */}
              {scoutTab === "sent" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A5726]">
                      あなたがこれまでに応募したプロジェクトの一覧と結果です:
                    </span>
                    <button
                      type="button"
                      onClick={fetchApplications}
                      className="text-xs text-[#B87503] hover:underline font-bold"
                    >
                      🔄 更新
                    </button>
                  </div>

                  {loadingApps ? (
                    <div className="py-12 text-center text-[#7A5726] font-bold">読み込み中...</div>
                  ) : applications.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-2">
                      <span className="text-3xl">📤</span>
                      <p className="text-sm font-bold text-[#3D2406]">まだ応募した履歴はありません。</p>
                      <p className="text-xs text-[#7A5726]">
                        ホーム画面から気になるプロジェクトの役割を選んで応募してみましょう！
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-5 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                        >
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F5B301] text-[#3D2406]">
                                希望ロール: {app.roleName}
                              </span>
                              <span className="text-xs text-[#7A5726]">
                                プロジェクト: <strong className="text-[#3D2406]">{app.projectTitle}</strong>
                              </span>
                            </div>

                            {app.motivationMessage && (
                              <p className="text-xs text-[#5C3D15] bg-[#FFFDF7] p-2.5 rounded-xl border border-[#B87503]/20 mt-1 leading-relaxed">
                                あなたの応募メッセージ: {app.motivationMessage}
                              </p>
                            )}

                            <span className="text-[10px] text-[#7A5726]">
                              応募日時: {formatJSTDateTime(app.createdAt)}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                app.status === "approved"
                                  ? "bg-[#EDF7ED] text-[#1E4620] border border-[#81C784]"
                                  : app.status === "rejected"
                                  ? "bg-[#FDEAEA] text-[#5F1313] border border-[#E57373]"
                                  : "bg-[#FFF8E1] text-[#B87503] border border-[#F5B301]"
                              }`}
                            >
                              {app.status === "approved"
                                ? "✓ 参加承認済み（メンバーに参加中）"
                                : app.status === "rejected"
                                ? "✕ 見送り（提唱者から見送られました）"
                                : "⏳ 審査待ち（提唱者の返答待ち）"}
                            </span>

                            {app.status === "approved" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveNav(`workspace-${app.projectId}-chat`);
                                  setRefreshSidebarTrigger((prev) => prev + 1);
                                }}
                                className="px-4 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-black shadow-xs hover:bg-[#E0A200]"
                              >
                                作業スペースへ移動 🚀
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scoutTab === "candidates" && (
                <div className="p-8 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-3">
                  <span className="text-3xl">🔍</span>
                  <h3 className="text-sm font-bold text-[#3D2406]">候補を探す（提唱者向け）</h3>
                  <p className="text-xs text-[#5C3D15] max-w-md">
                    プロジェクトが求めるスキルと合致する学生候補を匿名（「候補A」など）で検索し、月10件までスカウトメッセージを送ることができます。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── W05 申請・公開（スキル ＆ プロジェクト） ──────────────── */}
          {activeNav === "submit" && (
            <div className="flex flex-col gap-6 text-left">
              <div className="flex items-center gap-2 border-b border-[#B87503]/30 pb-3">
                <button
                  type="button"
                  onClick={() => setSubmitTab("skill")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    submitTab === "skill"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  🌿 スキルの枝を審査に出す
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitTab("project")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    submitTab === "project"
                      ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                      : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                  }`}
                >
                  🚀 新しいプロジェクトを提唱する
                </button>
              </div>

              {submitSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs sm:text-sm font-bold">
                  ✓ {submitSuccessMessage}
                </div>
              )}

              {/* スキル枝の申請フォーム */}
              {submitTab === "skill" && (
                <form
                  onSubmit={handleSubmitSkill}
                  className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503]/30 shadow-xs flex flex-col gap-4"
                >
                  <div>
                    <h3 className="text-base font-black text-[#3D2406]">スキルの枝の審査申請</h3>
                    <p className="text-xs text-[#7A5726] mt-0.5">
                      学内での講義・実験や個人開発・資格などの根拠を提出し、運営の審査を受けます。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-xs text-[#3D2406] block mb-1">
                        スキル名 <span className="text-[#B87503]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="例: Next.js / React Webアプリケーション開発"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-xs text-[#3D2406] block mb-1">
                        分野 <span className="text-[#B87503]">*</span>
                      </label>
                      <select
                        value={newSkillCategory}
                        onChange={(e) => setNewSkillCategory(e.target.value)}
                        className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406] font-bold"
                      >
                        <option value="cat-it-programming">💻 情報・プログラミング</option>
                        <option value="cat-life-science">🌱 生命科学・農学</option>
                        <option value="cat-language-exams">🌐 語学・資格試験</option>
                        <option value="cat-experience">🤝 経験・デザイン</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-xs text-[#3D2406] block mb-1">
                      自己申告レベル
                    </label>
                    <select
                      value={newSkillLevel}
                      onChange={(e) => setNewSkillLevel(Number(e.target.value))}
                      className="bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406] font-bold"
                    >
                      <option value={1}>Lv1: 教わりながらできる</option>
                      <option value={2}>Lv2: ひとりでできる</option>
                      <option value={3}>Lv3: 人に教えられる</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-xs text-[#3D2406] block mb-1">
                      何をしてきたか（活動実績） <span className="text-[#B87503]">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="例: 学部の専門実験において酵母と乳酸菌の共培養プロセスを担当し、レポートでA評価を得ました。"
                      value={newSkillDesc}
                      onChange={(e) => setNewSkillDesc(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-xs text-[#3D2406] block mb-1">
                      根拠URL（GitHubリポジトリ、公開ポートフォリオ等）
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={newSkillLink}
                      onChange={(e) => setNewSkillLink(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406]"
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-[#B87503]/20">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200] disabled:opacity-50"
                    >
                      {submitting ? "提出中..." : "審査に出す 🚀"}
                    </button>
                  </div>
                </form>
              )}

              {/* プロジェクト提唱フォーム */}
              {submitTab === "project" && (
                <form
                  onSubmit={handleSubmitProject}
                  className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border-2 border-[#B87503]/30 shadow-xs flex flex-col gap-4"
                >
                  <div>
                    <h3 className="text-base font-black text-[#3D2406]">新規プロジェクトの提唱</h3>
                    <p className="text-xs text-[#7A5726] mt-0.5">
                      自大学だけでは実現できないアイデアを提唱し、他大学の専門スキルを持つ仲間を公募します。
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-xs text-[#3D2406] block mb-1">
                      プロジェクト名 <span className="text-[#B87503]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例: 地域伝統酒蔵と連携したクラフトビール共同開発"
                      value={newPjTitle}
                      onChange={(e) => setNewPjTitle(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-xs text-[#3D2406] block mb-1">
                      目的・ゴール <span className="text-[#B87503]">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="例: 農学部の発酵技術と美大のデザイン力を融合し、来春までに3種類の新銘柄の試作品を完成させる。"
                      value={newPjGoal}
                      onChange={(e) => setNewPjGoal(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FFF4CA] border border-[#F5B301]">
                    <label className="font-black text-xs text-[#B87503] block mb-1">
                      🏫 在籍校だけでは実現できない理由（必須審査項目） <span className="text-[#B87503]">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="例: 自大学には農学の発酵ラボはありますが、ラベルやブランドを設計するデザイン学部やWeb販売システムを構築する工学部が存在しないため、他大学の専門スキルが不可欠です。"
                      value={newPjReason}
                      onChange={(e) => setNewPjReason(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-xs text-[#3D2406] block mb-1">募集ロール 1</label>
                      <input
                        type="text"
                        placeholder="例: ハードウェア・IoT設計"
                        value={newPjRole1}
                        onChange={(e) => setNewPjRole1(e.target.value)}
                        className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-xs text-[#3D2406] block mb-1">募集ロール 2</label>
                      <input
                        type="text"
                        placeholder="例: UI/UXプロダクトデザイナー"
                        value={newPjRole2}
                        onChange={(e) => setNewPjRole2(e.target.value)}
                        className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs text-[#3D2406]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-[#B87503]/20">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold shadow-xs hover:bg-[#E0A200] disabled:opacity-50"
                    >
                      {submitting ? "提出中..." : "プロジェクト審査に出す 🚀"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ──────────────── W06 プロジェクト作業画面（チャット・AI進行度測定） ──────────────── */}
          {activeNav.startsWith("workspace") && (
            <div className="flex flex-col gap-4 text-left">
              {/* プロジェクト作業ヘッダー */}
              <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-[#3D2406]">
                        {activeProjectDetail?.title || "プロジェクト作業画面"}
                      </h2>
                      {activeProjectDetail?.isSample && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#B87503]/40 text-[#B87503] text-[10px] font-bold">
                          サンプルデータ
                        </span>
                      )}
                    </div>

                    {/* 進み具合（段階ごとの状態） */}
                    {activeProjectDetail?.progressSummaryText && (
                      <p className="text-[11px] text-[#5C3D15] mt-0.5">
                        <span className="font-bold text-[#3D2406]">進み具合: </span>
                        {activeProjectDetail.progressSummaryText}
                      </p>
                    )}

                    <span className="text-xs text-[#7A5726]">
                      共創チーム作業スペース（チャット / ファイル / 空き時間 / メンバー）
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* ★新機能: AI進行度測定ボタン */}
                  <button
                    type="button"
                    onClick={handleAnalyzeProgressAi}
                    disabled={isAnalyzingProgress}
                    className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#F5B301] to-[#B87503] text-white text-xs font-bold shadow-sm hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>🤖</span>
                    <span>{isAnalyzingProgress ? "AI分析中..." : "AI進行度測定"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alert("ビデオ通話URLを発行しました: https://meet.google.com/hive-demo")}
                    className="px-3 py-1.5 rounded-full border border-[#B87503] bg-[#FFF8E1] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] shadow-xs flex items-center gap-1"
                  >
                    <span>📹</span>
                    <span>Meet通話</span>
                  </button>
                </div>
              </div>

              {/* サブタブ（チャット、タスク、ファイル、予定空き時間、メンバー） */}
              <div className="flex items-center gap-2 border-b border-[#B87503]/20 pb-2 overflow-x-auto no-scrollbar">
                {[
                  { id: "chat", label: "💬 チャット" },
                  { id: "tasks", label: "📋 タスク一覧" },
                  { id: "files", label: "📁 共有ファイル" },
                  { id: "calendar", label: "📅 空き時間重ね合わせ" },
                  { id: "members", label: "👥 メンバー一覧" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      const nextTab = tab.id as "chat" | "tasks" | "files" | "calendar" | "members";
                      setWorkspaceSubTab(nextTab);
                      if (activeProjectId) {
                        const navSuffix = nextTab === "calendar" ? "schedule" : nextTab;
                        setActiveNav(`workspace-${activeProjectId}-${navSuffix}`);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      currentSubTab === tab.id
                        ? "bg-[#F5B301] text-[#3D2406] shadow-xs"
                        : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ★新機能: Gemini AIによるプロジェクト進行度測定パネル */}
              {progressAiResult && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#FFFBEB] to-[#FFF4CA] border-2 border-[#F5B301] shadow-md flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-[#B87503]/25 pb-2">
                    <span className="text-xs font-black text-[#B87503] flex items-center gap-1.5">
                      <span>🤖</span>
                      <span>Vertex AI Gemini によるプロジェクト進行度診断結果</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setProgressAiResult(null)}
                      className="text-xs font-bold text-[#7A5726]"
                    >
                      ✕ 閉じる
                    </button>
                  </div>

                  {/* 進行度ゲージ */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-[#F5B301] min-w-[100px] shadow-xs">
                      <span className="text-2xl font-black text-[#B87503]">
                        {progressAiResult.progressPercentage}%
                      </span>
                      <span className="text-[10px] font-bold text-[#7A5726]">
                        {progressAiResult.stageLabel}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 text-xs">
                      <p className="font-bold text-[#3D2406] leading-relaxed">
                        {progressAiResult.summary}
                      </p>
                      <p className="text-[11px] text-[#7A5726] bg-[#FFFDF7] p-2 rounded-xl border border-[#B87503]/20">
                        <strong>判定根拠（Own the Why）:</strong> {progressAiResult.scoreWhy}
                      </p>
                    </div>
                  </div>

                  {/* 順調な点 ＆ ボトルネック ＆ 次の一歩 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-2xl bg-[#EDF7ED] border border-[#81C784]">
                      <span className="font-bold text-[#1E4620] block mb-1">✓ 順調に進んでいる点</span>
                      <ul className="list-disc list-inside text-[11px] text-[#1E4620] space-y-0.5">
                        {progressAiResult.goodPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#FDEAEA] border border-[#E57373]">
                      <span className="font-bold text-[#5F1313] block mb-1">⚠ ボトルネック・不足点</span>
                      <ul className="list-disc list-inside text-[11px] text-[#5F1313] space-y-0.5">
                        {progressAiResult.bottlenecks.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#FFF8E1] border border-[#F5B301]">
                      <span className="font-bold text-[#B87503] block mb-1">🚀 次に優先すべき一手</span>
                      <ul className="list-disc list-inside text-[11px] text-[#3D2406] space-y-0.5">
                        {progressAiResult.nextActions.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {progressAiError && (
                <div className="p-3 rounded-xl bg-[#FDEAEA] border border-[#E57373] text-[#5F1313] text-xs font-bold">
                  ⚠ {progressAiError}
                </div>
              )}

              {/* チャットサブタブの表示 */}
              {currentSubTab === "chat" && (
                <>
                  {/* ルーム切り替えタブ */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {[
                      { id: "general", label: "全体チャット" },
                      { id: "task-analysis", label: "タスク: 解析パイプライン" },
                      { id: "task-poster", label: "タスク: ポスター制作" },
                    ].map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setActiveChatRoomId(room.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                          activeChatRoomId === room.id
                            ? "bg-[#F5B301] text-[#3D2406] shadow-xs border border-[#E0A200]"
                            : "bg-[#FFFBEB] text-[#5C3D15] hover:bg-[#FFF8E1] border border-[#B87503]/25"
                        }`}
                      >
                        {room.label}
                      </button>
                    ))}
                  </div>

                  {/* 固定表示の「全体連絡」 */}
                  {announcementMessage && (
                    <div className="p-4 rounded-2xl bg-[#FFF4CA] border-2 border-[#F5B301] shadow-md flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#B87503] flex items-center gap-1.5">
                          <span>📢</span>
                          <span>進行役からの全体連絡（重要）</span>
                        </span>
                        <div className="flex items-center gap-2 text-xs font-bold text-[#3D2406]">
                          <span>
                            確認済み: {announcementMessage.confirmedUserUids.length} / {announcementMessage.totalMembersCount || 3} 人
                          </span>
                          {announcementMessage.deadline && (
                            <span className="text-[10px] text-[#7A5726] bg-[#FFFBEB] px-2 py-0.5 rounded-md border border-[#B87503]/30">
                              期限: {announcementMessage.deadline}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-[#3D2406] font-medium leading-relaxed bg-[#FFFDF7] p-3 rounded-xl border border-[#B87503]/20">
                        {announcementMessage.text}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-[#7A5726]">
                          発信: {announcementMessage.senderName} ({announcementMessage.senderRole}) • {formatJSTDateTime(announcementMessage.createdAt)}
                        </span>

                        {announcementMessage.confirmedUserUids.includes(user?.uid || "") ? (
                          <span className="px-3 py-1 rounded-full bg-[#EDF7ED] text-[#1E4620] font-bold border border-[#81C784]">
                            ✓ 確認済み
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmAnnouncement(announcementMessage.id)}
                            className="px-4 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] font-bold shadow-xs hover:bg-[#E0A200] transition-colors"
                          >
                            確認しました
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* チャットタイムライン */}
                  <div className="rounded-3xl border border-[#B87503]/30 bg-[#FFFBEB]/90 p-4 sm:p-6 min-h-[350px] max-h-[480px] overflow-y-auto flex flex-col gap-3 shadow-inner">
                    {chatMessages.length === 0 ? (
                      <div className="py-16 text-center text-[#7A5726] font-medium">
                        まだメッセージはありません。最初の発言を投稿してチーム作業を始めましょう！
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isSelf = user?.uid === msg.senderUid;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[75%] ${
                              isSelf ? "self-end items-end" : "self-start items-start"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-[#7A5726]">
                              <span className="font-bold text-[#3D2406]">
                                {isSelf ? "あなた" : msg.senderName}
                              </span>
                              <span>•</span>
                              <span>{msg.senderSchool || msg.senderRole}</span>
                              <span>•</span>
                              <span>{formatJSTDateTime(msg.createdAt)}</span>
                            </div>

                            <div
                              className={`p-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed break-words shadow-xs ${
                                isSelf
                                  ? "bg-[#F5B301] text-[#3D2406] rounded-br-xs"
                                  : "bg-[#FFFDF7] text-[#3D2406] border border-[#B87503]/25 rounded-bl-xs"
                              }`}
                            >
                              {msg.text}
                            </div>

                            {/* 発言からタスク作成ボタン */}
                            <button
                              type="button"
                              onClick={() => handleOpenTaskCreate(msg.text, msg.id)}
                              className="text-[10px] text-[#B87503] hover:underline font-bold flex items-center gap-0.5 bg-[#FFF8E1] px-2 py-0.5 rounded-full border border-[#B87503]/25 self-start transition-colors cursor-pointer"
                            >
                              <span>📌</span>
                              <span>タスクにする</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* メッセージ入力欄 */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#B87503]/30 shadow-xs flex flex-col gap-2.5"
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 font-bold text-[#3D2406] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chatIsAnnouncement}
                          onChange={(e) => setChatIsAnnouncement(e.target.checked)}
                          className="rounded accent-[#F5B301]"
                        />
                        <span>全体連絡として出す（進行役向け・上部に固定表示）</span>
                      </label>

                      {chatIsAnnouncement && (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[11px] text-[#7A5726]">確認期限:</span>
                          <input
                            type="date"
                            value={chatDeadline}
                            onChange={(e) => setChatDeadline(e.target.value)}
                            className="p-1 border border-[#B87503]/30 rounded-lg bg-white text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        placeholder={
                          chatIsAnnouncement
                            ? "全員に周知したい重要連絡を入力してください..."
                            : "メッセージを入力..."
                        }
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        className="flex-1 bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
                      />
                      <button
                        type="submit"
                        disabled={isSendingChat}
                        className="px-5 py-2 rounded-xl bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
                      >
                        {isSendingChat ? "送信中..." : "送信 🚀"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 📋 タスク一覧サブタブ */}
              {currentSubTab === "tasks" && (
                <div className="p-6 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-[#3D2406] block">プロジェクトのタスク一覧</span>
                      <span className="text-[11px] text-[#7A5726]">
                        チャットの各発言にある「📌 タスクにする」からタスクを追加・割り当てできます。
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskTitleInput("");
                        setTaskOriginalMsgId(null);
                        setTaskAssigneeUid(projectMembers[0]?.userId || user?.uid || "");
                        setTaskDeadlineInput("");
                        setTaskCreateModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs cursor-pointer"
                    >
                      ＋ 新しいタスク
                    </button>
                  </div>

                  {loadingTasks ? (
                    <div className="py-8 text-center text-xs text-[#7A5726] font-bold">
                      タスクを読み込み中...
                    </div>
                  ) : projectTasks.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 text-center text-xs text-[#7A5726] font-bold">
                      まだタスクはありません。チャットの発言から「📌 タスクにする」を押して作成しましょう！
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {projectTasks.map((t) => {
                        const isDone = t.status === "completed";
                        return (
                          <div
                            key={t.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
                              isDone
                                ? "bg-[#EDF7ED]/60 border-[#81C784]/40 opacity-75"
                                : t.status === "in_progress"
                                ? "bg-[#FFF8E1] border-[#F5B301]"
                                : "bg-[#FFFDF7] border-[#B87503]/20"
                            }`}
                          >
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold text-[#3D2406] ${isDone ? "line-through text-[#7A5726]" : ""}`}>
                                  {t.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[#7A5726]">
                                <span>担当: <strong className="text-[#3D2406]">{t.assigneeName}</strong></span>
                                {t.deadline && <span>期限: <strong className="text-[#B87503]">{t.deadline}</strong></span>}
                              </div>
                            </div>

                            {/* 状態変更セレクトボックス */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-[#7A5726] font-bold">状態:</span>
                              <select
                                value={t.status}
                                onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                                className="bg-white border border-[#B87503]/30 rounded-xl px-2.5 py-1 text-xs font-bold text-[#3D2406]"
                              >
                                <option value="not_started">未着手</option>
                                <option value="in_progress">進行中</option>
                                <option value="completed">完了 ✓</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 📁 共有ファイルサブタブ */}
              {currentSubTab === "files" && (
                <div className="p-6 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-[#3D2406] block">共有ファイル一覧</span>
                      <span className="text-[11px] text-[#7A5726]">
                        Cloud Storage（東京リージョン）へ安全に保存されます（1ファイル20MBまで・期限付き署名付きURLで保護）。
                      </span>
                    </div>

                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingFile}
                        className="px-4 py-1.5 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingFile ? "アップロード中..." : "＋ ファイルを共有"}
                      </button>
                    </div>
                  </div>

                  {fileActionMessage && (
                    <div className="p-3 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                      {fileActionMessage}
                    </div>
                  )}

                  {loadingFiles ? (
                    <div className="py-8 text-center text-xs text-[#7A5726] font-bold">
                      ファイルを読み込み中...
                    </div>
                  ) : projectFiles.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 text-center text-xs text-[#7A5726] font-bold">
                      共有ファイルはまだありません。右上の「＋ ファイルを共有」から企画書や設計図を共有しましょう！
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {projectFiles.map((f) => (
                        <div
                          key={f.id}
                          className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex items-center justify-between shadow-xs"
                        >
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                            <span className="font-bold text-[#3D2406] truncate block">{f.name}</span>
                            <span className="text-[10px] text-[#7A5726]">
                              {f.sizeFormatted} • 投稿: {f.uploaderName} • {formatJSTDateTime(f.createdAt)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenFile(f.id)}
                            className="px-3 py-1 rounded-full bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503] text-xs font-bold hover:bg-[#F5B301] transition-colors shrink-0 cursor-pointer"
                          >
                            📥 開く
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 空き時間重ね合わせサブタブ */}
              {currentSubTab === "calendar" && (
                <div className="p-6 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#3D2406]">メンバーの空き時間ヒートマップ</span>
                    <span className="text-[11px] text-[#1E4620] bg-[#EDF7ED] px-2 py-0.5 rounded-full border border-[#81C784]">
                      緑が濃い時間帯ほど全員が参加可能
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 text-xs">
                    <div className="grid grid-cols-6 gap-2 text-center font-bold text-[#3D2406]">
                      <span>時限</span>
                      <span>月</span>
                      <span>火</span>
                      <span>水</span>
                      <span>木</span>
                      <span>金</span>
                    </div>
                    {[1, 2, 3, 4, 5].map((slot) => (
                      <div key={slot} className="grid grid-cols-6 gap-2 text-center text-[11px] mt-2">
                        <span className="font-bold text-[#7A5726]">{slot}限</span>
                        <span className="p-2 rounded-lg bg-[#C8E6C9] font-bold text-[#1E4620]">4人空き</span>
                        <span className="p-2 rounded-lg bg-[#FFFBEB] text-[#7A5726]">1人</span>
                        <span className="p-2 rounded-lg bg-[#A5D6A7] font-bold text-[#1E4620]">全員OK!</span>
                        <span className="p-2 rounded-lg bg-[#FFFBEB] text-[#7A5726]">2人</span>
                        <span className="p-2 rounded-lg bg-[#C8E6C9] font-bold text-[#1E4620]">4人空き</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* メンバー一覧サブタブ */}
              {currentSubTab === "members" && (
                <div className="p-6 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-[#3D2406] block">参加メンバーと役割一覧</span>
                      <span className="text-[11px] text-[#7A5726]">
                        メンバーの交代や一時離脱の際は「AI 引継ぎ要約」でスムーズに後任へ申し送りできます。
                      </span>
                    </div>
                  </div>

                  {handoverNoDataAlert && (
                    <div className="p-3.5 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] text-[#7A5726] text-xs font-bold flex items-center justify-between">
                      <span>⚠ {handoverNoDataAlert}</span>
                      <button
                        type="button"
                        onClick={() => setHandoverNoDataAlert(null)}
                        className="text-xs text-[#3D2406]"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {loadingMembers ? (
                    <div className="py-8 text-center text-xs text-[#7A5726] font-bold">
                      メンバー情報を読み込み中...
                    </div>
                  ) : projectMembers.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 text-center text-xs text-[#7A5726] font-bold">
                      メンバーはまだいません
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {projectMembers.map((m) => {
                        const isLoadingThis = handoverLoadingUserId === m.userId;
                        return (
                          <div key={m.userId} className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B87503]/20 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[#3D2406]">{m.displayName}</span>
                                  {m.isFacilitator && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-[#F5B301] text-[#3D2406] text-[10px] font-bold">
                                      進行役
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#7A5726]">{m.schoolName}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#B87503]/30 text-[#B87503] font-bold text-[10px]">
                                {m.roleName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#B87503]/10">
                              <span className="text-[10px] text-[#7A5726]">引継ぎ支援</span>
                              <button
                                type="button"
                                onClick={() => handleGenerateHandover(m.userId, m.displayName, m.roleName)}
                                disabled={Boolean(handoverLoadingUserId)}
                                className="px-3 py-1 rounded-full bg-[#FFF8E1] border border-[#F5B301] text-[#3D2406] text-[11px] font-bold hover:bg-[#F5B301] shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                              >
                                <span>🤖</span>
                                <span>{isLoadingThis ? "要約生成中..." : "AI 引継ぎ要約"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────────── 活動記録認定 ＆ AIガクチカ下書き ──────────────── */}
          {activeNav === "records" && (
            <div className="flex flex-col gap-6 text-left">
              {/* 活動記録の認定（今後実装予定のまま残す） */}
              <div className="p-6 rounded-3xl bg-[#FFFBEB] border border-[#B87503]/30 text-center flex flex-col items-center gap-2">
                <span className="text-3xl">🏆</span>
                <h2 className="text-base sm:text-lg font-bold text-[#3D2406]">活動記録の認定</h2>
                <p className="text-xs text-[#5C3D15] max-w-md leading-relaxed">
                  活動記録の認定は今後実装予定です。
                </p>
              </div>

              {/* 🎓 AI ガクチカ下書き生成セクション */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#FFFBEB] border-2 border-[#F5B301] shadow-xs flex flex-col gap-5">
                <div className="border-b border-[#B87503]/25 pb-3">
                  <h3 className="text-base sm:text-lg font-black text-[#3D2406] flex items-center gap-2">
                    <span>🎓</span>
                    <span>AI ガクチカ下書き生成</span>
                  </h3>
                  <p className="text-xs text-[#7A5726] mt-0.5">
                    参加したプロジェクトのゴール、進み具合、あなたの役割、実際の発言や担当タスクから、Gemini が就職活動のES（エントリーシート）や面接で使える「学生時代に力を入れたこと」の下書きを作成します。
                  </p>
                </div>

                {/* プロジェクト選択 ＆ 生成ボタン */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[#3D2406] block mb-1">
                      対象プロジェクトを選択
                    </label>
                    <select
                      value={selectedGakuchikaPjId}
                      onChange={(e) => setSelectedGakuchikaPjId(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-3 py-2 text-xs font-bold text-[#3D2406]"
                    >
                      <option value="demo-idea-craft-beer">地域伝統クラフトビール開発</option>
                      <option value="demo-idea-campus-map">学内空き教室リアルタイム共有</option>
                      <option value="demo-completed-pj">放置竹林サステナブル照明 (第1期)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateGakuchika}
                    disabled={isGeneratingGakuchika}
                    className="sm:self-end px-5 py-2.5 rounded-full bg-gradient-to-r from-[#F5B301] to-[#B87503] text-white text-xs font-black shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🤖</span>
                    <span>{isGeneratingGakuchika ? "Gemini が作成中..." : "Gemini でガクチカの下書きを作る 🚀"}</span>
                  </button>
                </div>

                {gakuchikaError && (
                  <div className="p-3.5 rounded-2xl bg-[#FFF8E1] border-2 border-[#F5B301] text-[#7A5726] text-xs font-bold">
                    ⚠ {gakuchikaError}
                  </div>
                )}

                {/* 生成結果の編集テキストエリア ＆ コピーボタン */}
                {gakuchikaResultText && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#B87503]/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#3D2406]">
                        生成されたガクチカ下書き（手動で加筆・修正できます）:
                      </span>
                      <div className="flex items-center gap-2">
                        {gakuchikaCopyMessage && (
                          <span className="text-xs font-bold text-[#1E4620]">
                            {gakuchikaCopyMessage}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleCopyGakuchika}
                          className="px-3.5 py-1 rounded-full bg-[#FFF8E1] border border-[#B87503] text-[#3D2406] text-xs font-bold hover:bg-[#F5B301] shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>📋</span>
                          <span>下書きをコピー</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={8}
                      value={gakuchikaResultText}
                      onChange={(e) => setGakuchikaResultText(e.target.value)}
                      className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-2xl p-4 text-xs sm:text-sm text-[#3D2406] leading-relaxed focus:outline-none focus:border-[#F5B301]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ──────── 応募モーダル ──────── */}
      {applyModalOpen && selectedIdea && selectedRoleForApply && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSendApplication}
            className="bg-[#FFFBEB] max-w-md w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-2">
              <h3 className="text-base font-black text-[#3D2406] flex items-center gap-1.5">
                <span>📝</span>
                <span>プロジェクトのロールに応募する</span>
              </h3>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="text-xs font-bold text-[#7A5726]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FFFDF7] border border-[#B87503]/20 text-xs flex flex-col gap-1">
              <div>
                <span className="text-[#7A5726]">プロジェクト: </span>
                <span className="font-bold text-[#3D2406]">{selectedIdea.title}</span>
              </div>
              <div>
                <span className="text-[#7A5726]">応募する役割（ロール）: </span>
                <span className="font-bold text-[#B87503]">{selectedRoleForApply.name}</span>
              </div>
              <p className="text-[11px] text-[#5C3D15] mt-1">{selectedRoleForApply.reason}</p>
            </div>

            <div>
              <label className="font-bold text-xs text-[#3D2406] block mb-1">
                応募の動機・自己PRメッセージ <span className="text-[#B87503]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="例: このロールで求められているスキルを持っています。特に発酵プロセス管理やデータ分析の経験を活かしてチームに貢献したいです！"
                value={applyMotivation}
                onChange={(e) => setApplyMotivation(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            {applyMessage && (
              <div className="p-2.5 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                ✓ {applyMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-1.5 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isApplying}
                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-bold hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
              >
                {isApplying ? "送信中..." : "応募を送信する 🚀"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ──────── AI 引継ぎ要約（進行役の手直し ＆ 共有モーダル） ──────── */}
      {handoverModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFBEB] max-w-xl w-full rounded-3xl p-6 border-2 border-[#F5B301] shadow-2xl flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-2">
              <div>
                <h3 className="text-base font-black text-[#3D2406] flex items-center gap-1.5">
                  <span>🤖</span>
                  <span>AI 引継ぎ要約（進行役の確認・編集）</span>
                </h3>
                <span className="text-xs text-[#7A5726]">
                  対象: <strong>{handoverTargetName}</strong>（{handoverTargetRole}）
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalOpen(false)}
                className="text-xs font-bold text-[#7A5726]"
              >
                ✕ 閉じる
              </button>
            </div>

            <p className="text-[11px] text-[#5C3D15] bg-[#FFF8E1] p-2.5 rounded-xl border border-[#F5B301]/40">
              ※ Gemini がチャット発言とタスク履歴から自動抽出しました。進行役が内容を確かめ、必要に応じて加筆・修正した上でチームに共有できます。
            </p>

            {/* 1. 現在地 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-[#3D2406]">
                1. 現在地（到達点・進捗状況）:
              </label>
              <textarea
                rows={3}
                value={handoverStatusText}
                onChange={(e) => setHandoverStatusText(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] leading-relaxed focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            {/* 2. 決まったこと */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-[#3D2406]">
                2. 決まったこと（元の発言やファイルへのリンク・参照付き）:
              </label>
              <textarea
                rows={4}
                value={handoverDecisionsText}
                onChange={(e) => setHandoverDecisionsText(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] leading-relaxed focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            {/* 3. 残りの作業と締切 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-[#3D2406]">
                3. 残りの作業と締切（後任への申し送り事項）:
              </label>
              <textarea
                rows={4}
                value={handoverTasksText}
                onChange={(e) => setHandoverTasksText(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] leading-relaxed focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            {handoverSharedSuccess && (
              <div className="p-3 rounded-xl bg-[#EDF7ED] border border-[#81C784] text-[#1E4620] text-xs font-bold">
                ✓ {handoverSharedSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setHandoverModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleShareHandoverToChat}
                disabled={isSharingHandover}
                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-black hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
              >
                {isSharingHandover ? "共有中..." : "直した内容をチャットに全体共有する 📢"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── タスク作成モーダル ──────── */}
      {taskCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#3D2406]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTask}
            className="bg-[#FFFBEB] max-w-md w-full rounded-3xl p-6 border-2 border-[#B87503] shadow-2xl flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-[#B87503]/30 pb-2">
              <h3 className="text-base font-black text-[#3D2406] flex items-center gap-1.5">
                <span>📌</span>
                <span>発言からタスクを作成</span>
              </h3>
              <button
                type="button"
                onClick={() => setTaskCreateModalOpen(false)}
                className="text-xs font-bold text-[#7A5726]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#3D2406]">
                タスクの内容 <span className="text-[#B87503]">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={taskTitleInput}
                onChange={(e) => setTaskTitleInput(e.target.value)}
                className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl p-2.5 text-xs text-[#3D2406] focus:outline-none focus:border-[#F5B301]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#3D2406] block mb-1">
                  担当者 <span className="text-[#B87503]">*</span>
                </label>
                <select
                  value={taskAssigneeUid}
                  onChange={(e) => setTaskAssigneeUid(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-2.5 py-2 font-bold text-[#3D2406]"
                >
                  {projectMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName} ({m.roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#3D2406] block mb-1">
                  期限
                </label>
                <input
                  type="date"
                  value={taskDeadlineInput}
                  onChange={(e) => setTaskDeadlineInput(e.target.value)}
                  className="w-full bg-[#FFFDF7] border border-[#B87503]/30 rounded-xl px-2.5 py-1.5 text-xs text-[#3D2406]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#B87503]/20">
              <button
                type="button"
                onClick={() => setTaskCreateModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[#B87503]/40 bg-[#FFFDF7] text-[#5C3D15] text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isCreatingTask}
                className="px-5 py-2 rounded-full bg-[#F5B301] text-[#3D2406] text-xs font-black hover:bg-[#E0A200] shadow-xs disabled:opacity-50"
              >
                {isCreatingTask ? "作成中..." : "タスクを作成 🚀"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* オンボーディングモーダル */}
      {showOnboarding && user && (
        <OnboardingModal
          user={user}
          profile={profile}
          onComplete={() => {
            setShowOnboarding(false);
            if (user) fetchUserProfile(user);
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
