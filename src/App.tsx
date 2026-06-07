import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Car,
  Calendar,
  User,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  LayoutDashboard,
  LogOut,
  Users,
  FileText,
  Phone,
  Briefcase,
  Info,
  LogIn,
  UserPlus,
  Download,
  Lock,
  Camera,
  Mail,
  Wifi,
  WifiOff,
  Edit2,
  UserX,
  UserCheck,
  Search,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
// motion/react re-exports AnimatePresence from framer-motion at runtime (CJS confirmed)
// Import both from motion/react to avoid framer-motion's broken ESM exports in Vite
// @ts-expect-error motion/react types don't declare AnimatePresence but CJS runtime does
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import BookingPdfTemplate from "./components/BookingPdfTemplate";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase";
import { toAuthEmail } from "./lib/auth-identifier";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface UserData {
  id: string;           // UUID from auth.users / profiles
  email: string;
  name: string;
  position: string;
  organization: string;
  internal_tel: string;
  mobile_tel?: string;
  role: "admin" | "staff" | "user";
  must_change_password?: boolean;
  is_active?: boolean;
}

// Full profile record used in admin user management
interface ProfileRecord {
  id: string;
  email: string;
  name: string;
  position?: string;
  organization?: string;
  internal_tel?: string;
  mobile_tel?: string;
  role: "admin" | "staff" | "user";
  is_active: boolean;
  must_change_password?: boolean;
  created_at?: string;
}

interface Driver {
  id: number;
  name: string;
  tel: string;
  image?: string;
}

interface CarData {
  id: number;
  name: string;
  type: string;
  image: string;
  license_plate?: string;
  seats?: number;
  driver_id?: number;
  driver_name?: string;
  driver_tel?: string;
  available: boolean;
}

interface Booking {
  id: number;
  car_id: number;
  vehicle_id?: number;
  user_id: string;       // UUID string
  car_name: string;
  car_license: string;
  car_type: string;
  user_name: string;
  user_position: string;
  user_organization: string;
  tel: string;
  destination?: string;
  objective: string;
  passenger: number;
  note: string;
  date_start: string;
  date_finish: string;
  time_start: string;
  time_finish: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reject_reason?: string;
  driver_id?: number;
  driver_name?: string;
  driver_tel?: string;
}

const EMPTY_AUTH_FORM = {
  email: "",
  password: "",
  name: "",
  position: "",
  organization: "",
  internal_tel: "",
  mobile_tel: "",
};

type AuthUserRecord = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const SYSTEM_NAME = "ระบบจองรถยนต์ กองการเจ้าหน้าที่ กสร.";

const buildLegacyDateTime = (date: string, time: string) => `${date}T${time}:00`;

const getBookingStatusMeta = (status: Booking["status"]) => {
  switch (status) {
    case "approved":
      return {
        badgeClass: "bg-emerald-100 text-emerald-700",
        label: "อนุมัติแล้ว",
      };
    case "rejected":
      return {
        badgeClass: "bg-rose-100 text-rose-700",
        label: "ปฏิเสธ",
      };
    case "cancelled":
      return {
        badgeClass: "bg-slate-200 text-slate-600",
        label: "ยกเลิกแล้ว",
      };
    default:
      return {
        badgeClass: "bg-amber-100 text-amber-700",
        label: "รอดำเนินการ",
      };
  }
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSupabaseOnline, setIsSupabaseOnline] = useState(false); // New state for Supabase connection status
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [authFormData, setAuthFormData] = useState(EMPTY_AUTH_FORM);

  const [view, setView] = useState<"user" | "admin">("user");
  const [adminTab, setAdminTab] = useState<"approvals" | "bookings" | "cars" | "drivers" | "users">("approvals");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ทั้งหมด");
  const [cars, setCars] = useState<CarData[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarData | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // PDF export state
  const [pdfBooking, setPdfBooking] = useState<Booking | null>(null);
  const pdfTemplateRef = React.useRef<HTMLDivElement>(null);

  // New Booking form state
  const [formData, setFormData] = useState({
    user_name: "",
    user_position: "",
    user_organization: "",
    tel: "",
    destination: "",
    objective: "",
    passenger: 1,
    note: "",
    date_start: "",
    date_finish: "",
    time_start: "08:30",
    time_finish: "16:30",
  });

  // Admin state
  const [newCar, setNewCar] = useState({
    name: "",
    type: "",
    image: "",
    license_plate: "",
    seats: 4,
    driver_id: "",
  });
  const [newDriver, setNewDriver] = useState({ name: "", tel: "", image: "" });
  const [editingCar, setEditingCar] = useState<CarData | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingBookingId, setRejectingBookingId] = useState<number | null>(null);

  const [filter, setFilter] = useState("ทั้งหมด");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [forcedPassword, setForcedPassword] = useState({
    password: "",
    confirm: "",
    error: "",
    saving: false,
  });

  // ── Admin: User Management ──────────────────────────────────
  const [allUsers, setAllUsers] = useState<ProfileRecord[]>([]);
  const [userSearchQ, setUserSearchQ] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ทั้งหมด");
  const [userStatusFilter, setUserStatusFilter] = useState("ทั้งหมด");
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileRecord | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    email: "", password: "", name: "", position: "",
    organization: "", internal_tel: "", mobile_tel: "", role: "user",
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "", position: "", organization: "",
    internal_tel: "", mobile_tel: "", role: "user",
    is_active: true, must_change_password: false,
  });

  // ── Settings panel ──────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProfileForm, setSettingsProfileForm] = useState({
    name: "", position: "", organization: "", internal_tel: "", mobile_tel: "",
  });
  const [settingsPwForm, setSettingsPwForm] = useState({
    password: "", confirm: "", error: "", saving: false,
  });
  const [settingsProfileSaving, setSettingsProfileSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Auth — Supabase session listener
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isNetworkFailure = (error: unknown): boolean => {
      const text =
        typeof error === "string"
          ? error
          : JSON.stringify(error ?? {}).toLowerCase();

      return (
        text.includes("failed to fetch") ||
        text.includes("networkerror") ||
        text.includes("fetch failed") ||
        text.includes("load failed") ||
        text.includes("err_name_not_resolved") ||
        text.includes("timeout")
      );
    };

    const pingSupabase = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });
        setIsSupabaseOnline(response.ok || response.status < 500);
      } catch (err) {
        console.error("Supabase ping failed:", err);
        setIsSupabaseOnline(!isNetworkFailure(err));
      }
    };

    const initializeRecoverySession = async () => {
      // PKCE: with detectSessionInUrl: true the SDK auto-calls exchangeCodeForSession()
      // on createClient. This function just cleans up the URL if a code was present.
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) return false;
      // SDK has already exchanged the code — clean the URL
      window.history.replaceState(null, '', window.location.pathname);
      // onAuthStateChange fires PASSWORD_RECOVERY → setAuthMode('reset')
      return true;
    };

    // 2. Get initial session and check connection
    (async () => {
      try {
        const inRecovery = await initializeRecoverySession();
        if (inRecovery) {
          setAuthLoading(false);
          setIsSupabaseOnline(true);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          fetchProfile(session.user.id);
          setIsSupabaseOnline(true); // User is logged in, so connected
        } else {
          setAuthLoading(false);
          pingSupabase(); // If no session, check general connection
        }
      } catch {
        setAuthLoading(false);
        setIsSupabaseOnline(false); // Initial session check failed
      }
    })();

    // 3. Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setAuthLoading(false);
        setIsSupabaseOnline(true);
        return;
      }

      if (session?.user) {
        fetchProfile(session.user.id);
        setIsSupabaseOnline(true);
      } else {
        setUser(null);
        setAuthLoading(false);
        pingSupabase(); // Keep connectivity status independent from login state
      }
    });

    // Periodically ping Supabase to check connection status
    const interval = setInterval(pingSupabase, 30000); // Check every 30 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (user) {
      fetchCars();
      fetchBookings();
      fetchDrivers();
      if (user.role === "admin") fetchAllUsers();
    }
  }, [user, view]);

  // Pre-fill booking form from user profile
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        user_name: user.name,
        user_position: user.position,
        user_organization: user.organization,
        tel: user.internal_tel,
      }));
    }
  }, [user]);

  // ─────────────────────────────────────────────────────────────
  // Auth helpers
  // ─────────────────────────────────────────────────────────────
  const buildUserFromAuth = (authUser: AuthUserRecord | null): UserData | null => {
    if (!authUser?.id || !authUser.email) return null;

    const meta = authUser.user_metadata ?? {};
    const role = meta.role;

    return {
      id: authUser.id,
      email: authUser.email,
      name: typeof meta.name === "string" && meta.name.trim() ? meta.name : authUser.email.split("@")[0],
      position: typeof meta.position === "string" ? meta.position : "",
      organization: typeof meta.organization === "string" ? meta.organization : "",
      internal_tel: typeof meta.internal_tel === "string" ? meta.internal_tel : "",
      mobile_tel: typeof meta.mobile_tel === "string" ? meta.mobile_tel : "",
      role: role === "admin" || role === "staff" || role === "user" ? role : "user",
    };
  };

  const buildProfilePayload = (authUser: AuthUserRecord) => {
    const fallbackUser = buildUserFromAuth(authUser);
    if (!fallbackUser) return null;

    return {
      id: fallbackUser.id,
      email: fallbackUser.email,
      name: fallbackUser.name,
      position: fallbackUser.position || null,
      organization: fallbackUser.organization || null,
      internal_tel: fallbackUser.internal_tel || null,
      mobile_tel: fallbackUser.mobile_tel || null,
      role: fallbackUser.role,
      is_active: true,
    };
  };

  const ensureProfileExists = async (userId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser || authUser.id !== userId || !authUser.email) return false;

    const profilePayload = buildProfilePayload(authUser);
    if (!profilePayload) return false;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          user: {
            id: authUser.id,
            email: authUser.email,
            raw_user_meta_data: authUser.user_metadata ?? {},
          },
        }),
      });

      if (response.ok) return true;
    } catch (error) {
      console.warn("create-profile function call failed:", error);
    }

    const { error } = await supabase.from("profiles").insert(profilePayload);
    if (error && error.code !== "23505") {
      console.warn("Direct profile insert failed:", error);
      return false;
    }

    return true;
  };

  const fetchProfile = async (userId: string) => {
    const getProfile = async () =>
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    let { data, error } = await getProfile();

    if (error || !data) {
      try {
        await ensureProfileExists(userId);
      } catch (createErr) {
        console.warn("ensureProfileExists failed:", createErr);
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const retry = await getProfile();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error("Unable to load profile:", error);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(buildUserFromAuth(authUser));
      setAuthLoading(false);
      return;
    }

    setUser(data as UserData);
    setAuthLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = authFormData.email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(identifier),
      password: authFormData.password,
    });
    if (error) alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
    // onAuthStateChange handles setUser
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) {
      alert("ไม่สามารถเข้าสู่ระบบด้วย Google ได้: " + error.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = authFormData.email.trim().toLowerCase();
    if (!email.includes("@")) {
      alert("กรุณาใช้อีเมลจริงสำหรับการสมัครสมาชิก");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: authFormData.password,
      options: {
        data: {
          name: authFormData.name.trim(),
          position: authFormData.position.trim(),
          organization: authFormData.organization.trim(),
          internal_tel: authFormData.internal_tel.trim(),
          mobile_tel: authFormData.mobile_tel.trim(),
        },
      },
    });
    if (error) {
      alert("ลงทะเบียนไม่สำเร็จ: " + error.message);
    } else {
      alert("ลงทะเบียนสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน (หรือเข้าสู่ระบบได้เลยหากไม่มีการยืนยันอีเมล)");
      setAuthFormData({
        ...EMPTY_AUTH_FORM,
        email,
      });
      setAuthMode("login");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView("user");
    setAuthMode("login");
  };

  const handleForcedPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (forcedPassword.password.length < 6) {
      setForcedPassword((prev) => ({ ...prev, error: "Password must be at least 6 characters." }));
      return;
    }

    if (forcedPassword.password !== forcedPassword.confirm) {
      setForcedPassword((prev) => ({ ...prev, error: "Passwords do not match." }));
      return;
    }

    setForcedPassword((prev) => ({ ...prev, error: "", saving: true }));

    const { error: authError } = await supabase.auth.updateUser({
      password: forcedPassword.password,
    });

    if (authError) {
      setForcedPassword((prev) => ({ ...prev, saving: false, error: authError.message }));
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    if (profileError) {
      setForcedPassword((prev) => ({ ...prev, saving: false, error: profileError.message }));
      return;
    }

    setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev));
    setForcedPassword({
      password: "",
      confirm: "",
      error: "",
      saving: false,
    });
  };

  // ─────────────────────────────────────────────────────────────
  // File upload helper (base64 — Phase 5 will migrate to Storage)
  // ─────────────────────────────────────────────────────────────
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Data fetchers — Supabase JS client
  // ─────────────────────────────────────────────────────────────
  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("*, drivers(id, name, tel)")
      .order("id");
    if (error) { console.error("fetchCars:", error); return; }
    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      driver_name: c.drivers?.name ?? null,
      driver_tel: c.drivers?.tel ?? null,
    }));
    setCars(mapped);
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase.from("drivers").select("*").order("id");
    if (error) { console.error("fetchDrivers:", error); return; }
    setDrivers(data ?? []);
  };

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("id", { ascending: false });
    if (error) { console.error("fetchBookings:", error); return; }
    const normalized = (data ?? []).map((booking: any) => ({
      ...booking,
      car_id: booking.car_id ?? booking.vehicle_id,
    }));
    setBookings(normalized);
  };

  // ─────────────────────────────────────────────────────────────
  // Booking CRUD
  // ─────────────────────────────────────────────────────────────
  const handleBooking = async () => {
    if (!selectedCar || !formData.date_start || !formData.date_finish || !formData.time_start || !formData.time_finish || !formData.user_name) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }
    const bookingPayload = {
      car_id: selectedCar.id,
      user_id: user?.id,
      start_at: buildLegacyDateTime(formData.date_start, formData.time_start),
      end_at: buildLegacyDateTime(formData.date_finish, formData.time_finish),
      car_name: selectedCar.name,
      car_license: selectedCar.license_plate ?? "",
      car_type: selectedCar.type,
      ...formData,
      purpose: formData.objective,
      status: "pending",
    };
    const { car_id, ...payloadWithoutCarId } = bookingPayload;
    const { start_at, end_at, ...payloadWithoutLegacyDateTimes } = bookingPayload;
    const { car_id: _legacyCarId, start_at: _legacyStartAt, end_at: _legacyEndAt, ...payloadWithoutCarIdAndLegacyDateTimes } = bookingPayload;

    const attemptPayloads = [
      bookingPayload,
      { ...bookingPayload, vehicle_id: selectedCar.id },
      { ...payloadWithoutCarId, vehicle_id: selectedCar.id },
      payloadWithoutLegacyDateTimes,
      { ...payloadWithoutLegacyDateTimes, vehicle_id: selectedCar.id },
      { ...payloadWithoutCarIdAndLegacyDateTimes, vehicle_id: selectedCar.id },
    ];

    let result = await supabase.from("bookings").insert([attemptPayloads[0]]);

    const isLegacySchemaMismatch = (message: string) =>
      message.includes("could not find")
      || (message.includes("null value") && (
        message.includes("vehicle_id")
        || message.includes("start_at")
        || message.includes("end_at")
      ));

    for (let i = 1; i < attemptPayloads.length && result.error; i += 1) {
      const errorMessage = result.error.message.toLowerCase();
      if (!isLegacySchemaMismatch(errorMessage)) break;
      result = await supabase.from("bookings").insert([attemptPayloads[i]]);
    }

    if (result.error) { alert("เกิดข้อผิดพลาด: " + result.error.message); return; }
    setIsBookingModalOpen(false);
    setSelectedCar(null);
    setFormData({
      user_name: user?.name ?? "",
      user_position: user?.position ?? "",
      user_organization: user?.organization ?? "",
      tel: user?.internal_tel ?? "",
      destination: "",
      objective: "",
      passenger: 1,
      note: "",
      date_start: "",
      date_finish: "",
      time_start: "08:30",
      time_finish: "16:30",
    });
    fetchBookings();
    alert("ส่งคำขอจองเรียบร้อยแล้ว!");
  };

  const handleUpdateBookingStatus = async (
    id: number,
    status: Booking["status"],
    reason?: string,
    driverId?: string
  ) => {
    const driver = driverId ? drivers.find(d => d.id === parseInt(driverId)) : null;
    const { error } = await supabase
      .from("bookings")
      .update({
        status,
        reject_reason: reason ?? null,
        driver_id: driverId ? parseInt(driverId) : null,
        driver_name: driver?.name ?? null,
        driver_tel: driver?.tel ?? null,
      })
      .eq("id", id);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    setRejectingBookingId(null);
    setRejectReason("");
    setSelectedDriverId("");
    fetchBookings();
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!confirm(`ยืนยันการยกเลิกการจองรถ ${booking.car_name}?`)) return;

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        reject_reason: null,
      })
      .eq("id", booking.id);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      return;
    }

    fetchBookings();
    alert("ยกเลิกการจองเรียบร้อยแล้ว");
  };

  // ─────────────────────────────────────────────────────────────
  // Car CRUD
  // ─────────────────────────────────────────────────────────────
  const handleAddCar = async (e: any) => {
    e.preventDefault();
    const { error } = await supabase.from("cars").insert([{
      name: newCar.name,
      type: newCar.type,
      image: newCar.image,
      license_plate: newCar.license_plate,
      seats: newCar.seats,
      driver_id: newCar.driver_id ? parseInt(newCar.driver_id) : null,
    }]);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    setNewCar({ name: "", type: "", image: "", license_plate: "", seats: 4, driver_id: "" });
    fetchCars();
  };

  const handleUpdateCar = async (e: any) => {
    e.preventDefault();
    if (!editingCar) return;
    const { error } = await supabase
      .from("cars")
      .update({ name: editingCar.name, type: editingCar.type, image: editingCar.image, license_plate: editingCar.license_plate, seats: editingCar.seats })
      .eq("id", editingCar.id);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    setEditingCar(null);
    fetchCars();
  };

  const handleDeleteCar = async (id: number) => {
    if (!confirm("ยืนยันการลบรถยนต์?")) return;
    const { error } = await supabase.from("cars").delete().eq("id", id);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    fetchCars();
  };

  // ─────────────────────────────────────────────────────────────
  // Driver CRUD
  // ─────────────────────────────────────────────────────────────
  const handleAddDriver = async (e: any) => {
    e.preventDefault();
    const { error } = await supabase.from("drivers").insert([newDriver]);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    setNewDriver({ name: "", tel: "", image: "" });
    fetchDrivers();
  };

  const handleUpdateDriver = async (e: any) => {
    e.preventDefault();
    if (!editingDriver) return;
    const { error } = await supabase
      .from("drivers")
      .update({ name: editingDriver.name, tel: editingDriver.tel, image: editingDriver.image })
      .eq("id", editingDriver.id);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    setEditingDriver(null);
    fetchDrivers();
    fetchCars();
  };

  const handleDeleteDriver = async (id: number) => {
    if (!confirm("ยืนยันการลบพนักงานขับรถ?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) { alert("เกิดข้อผิดพลาด: " + error.message); return; }
    fetchDrivers();
    fetchCars();
  };

  // ─────────────────────────────────────────────────────────────
  // PDF Export
  // ─────────────────────────────────────────────────────────────
  const exportPDF = async (booking: Booking) => {
    setPdfBooking(booking);
    await new Promise(resolve => setTimeout(resolve, 400));
    const el = pdfTemplateRef.current;
    if (!el) { setPdfBooking(null); return; }
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
      const doc = new jsPDF("p", "mm", "a4");
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      doc.save(`ใบขออนุญาตใช้รถยนต์_${booking.id}.pdf`);
    } finally {
      setPdfBooking(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Calendar helpers
  // ─────────────────────────────────────────────────────────────
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const days = Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => i + 1);
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();

  const isDateBooked = (day: number, carId: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bookings.some(b => b.car_id === carId && b.status === "approved" && dateStr >= b.date_start && dateStr <= b.date_finish);
  };

  const isDatePending = (day: number, carId: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bookings.some(b => b.car_id === carId && b.status === "pending" && dateStr >= b.date_start && dateStr <= b.date_finish);
  };

  // ─────────────────────────────────────────────────────────────
  // Admin: User Management helpers
  // ─────────────────────────────────────────────────────────────
  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchAllUsers:", error); return; }
    setAllUsers((data ?? []) as ProfileRecord[]);
  };

  const callAdminFunction = async (fnName: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("ไม่พบ session");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `${fnName} failed`);
    return json;
  };

  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email || !newUserForm.password || !newUserForm.name) {
      alert("กรุณากรอก Email, Password และ ชื่อ"); return;
    }
    try {
      await callAdminFunction("admin-create-user", newUserForm);
      alert("สร้างผู้ใช้สำเร็จ! ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก");
      setCreatingUser(false);
      setNewUserForm({ email: "", password: "", name: "", position: "", organization: "", internal_tel: "", mobile_tel: "", role: "user" });
      fetchAllUsers();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    }
  };

  const openEditUser = (u: ProfileRecord) => {
    setEditingUser(u);
    setEditUserForm({
      name: u.name,
      position: u.position ?? "",
      organization: u.organization ?? "",
      internal_tel: u.internal_tel ?? "",
      mobile_tel: u.mobile_tel ?? "",
      role: u.role,
      is_active: u.is_active,
      must_change_password: u.must_change_password ?? false,
    });
  };

  const handleAdminUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await callAdminFunction("admin-update-user", { user_id: editingUser.id, ...editUserForm });
      alert("อัปเดตข้อมูลผู้ใช้สำเร็จ");
      setEditingUser(null);
      fetchAllUsers();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    }
  };

  const handleAdminToggleActive = async (u: ProfileRecord) => {
    const action = u.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน";
    if (!confirm(`${action}บัญชี ${u.name}?`)) return;
    try {
      await callAdminFunction("admin-update-user", { user_id: u.id, is_active: !u.is_active });
      fetchAllUsers();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    }
  };

  const handleAdminDeleteUser = async (u: ProfileRecord) => {
    if (u.id === user?.id) {
      alert("ไม่สามารถลบบัญชีของตัวเองได้"); return;
    }
    if (!confirm(`ยืนยันการลบผู้ใช้ "${u.name}" (${u.email}) ?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await callAdminFunction("admin-delete-user", { user_id: u.id });
      alert("ลบผู้ใช้สำเร็จ");
      fetchAllUsers();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Settings: self-profile update + password change
  // ─────────────────────────────────────────────────────────────
  const openSettings = () => {
    if (!user) return;
    setSettingsProfileForm({
      name: user.name,
      position: user.position ?? "",
      organization: user.organization ?? "",
      internal_tel: user.internal_tel ?? "",
      mobile_tel: user.mobile_tel ?? "",
    });
    setSettingsPwForm({ password: "", confirm: "", error: "", saving: false });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSettingsProfileSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: settingsProfileForm.name,
        position: settingsProfileForm.position,
        organization: settingsProfileForm.organization,
        internal_tel: settingsProfileForm.internal_tel,
        mobile_tel: settingsProfileForm.mobile_tel,
      })
      .eq("id", user.id);
    setSettingsProfileSaving(false);
    if (error) { alert("บันทึกไม่สำเร็จ: " + error.message); return; }
    setUser(prev => prev ? { ...prev, ...settingsProfileForm } : prev);
    alert("บันทึกข้อมูลส่วนตัวสำเร็จ");
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsPwForm.password.length < 6) {
      setSettingsPwForm(p => ({ ...p, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" })); return;
    }
    if (settingsPwForm.password !== settingsPwForm.confirm) {
      setSettingsPwForm(p => ({ ...p, error: "รหัสผ่านไม่ตรงกัน" })); return;
    }
    setSettingsPwForm(p => ({ ...p, error: "", saving: true }));
    const { error } = await supabase.auth.updateUser({ password: settingsPwForm.password });
    if (error) {
      setSettingsPwForm(p => ({ ...p, saving: false, error: error.message })); return;
    }
    setSettingsPwForm({ password: "", confirm: "", error: "", saving: false });
    alert("เปลี่ยนรหัสผ่านสำเร็จ");
  };

  // ─────────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-200 w-fit mx-auto">
            <Car className="text-white w-10 h-10 animate-pulse" />
          </div>
          <p className="text-slate-500 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Auth screens
  // ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden">
          <div className="p-6 sm:p-10">
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-100 mb-6 text-white">
                <Car className="w-10 h-10" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">{SYSTEM_NAME}</h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium mt-2">ระบบสำหรับจองรถยนต์ภายในหน่วยงาน</p>
              <div className="mt-4">
                {isSupabaseOnline ? (
                  <Wifi className="w-5 h-5 text-emerald-500" title="Supabase Connected" />
                ) : (
                  <WifiOff className="w-5 h-5 text-rose-500" title="Supabase Disconnected" />
                )}
              </div>
            </div>

            {authMode === "login" && (
              <div className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Username or Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input type="text" required value={authFormData.email} onChange={e => setAuthFormData({ ...authFormData, email: e.target.value })}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="username or your@email.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                      <button type="button" onClick={() => setAuthMode("forgot")} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Forgot Password?</button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input type="password" required value={authFormData.password} onChange={e => setAuthFormData({ ...authFormData, password: e.target.value })}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 mt-4">
                    <LogIn className="w-5 h-5" /> Sign In
                  </button>
                </form>
                <div className="mt-6">
                  <button onClick={handleGoogleLogin} className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" className="w-5 h-5" /> Sign In with Google
                  </button>
                </div>
                <div className="text-center mt-4">
                  <p className="text-slate-500 text-sm">Don't have an account? <button onClick={() => setAuthMode("register")} className="text-indigo-600 font-bold hover:underline">Register Now</button></p>
                </div>
              </div>
            )}

            {authMode === "register" && (
              <div className="space-y-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="text"
                        required
                        value={authFormData.name}
                        onChange={e => setAuthFormData({ ...authFormData, name: e.target.value })}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="email"
                        required
                        value={authFormData.email}
                        onChange={e => setAuthFormData({ ...authFormData, email: e.target.value })}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Position</label>
                      <div className="relative group">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          value={authFormData.position}
                          onChange={e => setAuthFormData({ ...authFormData, position: e.target.value })}
                          className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Job title"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Organization</label>
                      <div className="relative group">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          value={authFormData.organization}
                          onChange={e => setAuthFormData({ ...authFormData, organization: e.target.value })}
                          className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Department or company"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Internal Tel</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          value={authFormData.internal_tel}
                          onChange={e => setAuthFormData({ ...authFormData, internal_tel: e.target.value })}
                          className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Office extension"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Mobile Tel</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          type="text"
                          value={authFormData.mobile_tel}
                          onChange={e => setAuthFormData({ ...authFormData, mobile_tel: e.target.value })}
                          className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Mobile number"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={authFormData.password}
                        onChange={e => setAuthFormData({ ...authFormData, password: e.target.value })}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="At least 8 characters"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 mt-4">
                    <UserPlus className="w-5 h-5" /> Create Account
                  </button>
                </form>
                <div className="text-center mt-6 pt-6 border-t border-slate-100">
                  <button onClick={() => setAuthMode("login")} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Already have an account? Sign In</button>
                </div>
                <div className="mt-4">
                  <button onClick={handleGoogleLogin} className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2">
                    <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" className="w-5 h-5" /> Sign Up with Google
                  </button>
                </div>
              </div>
            )}

            {authMode === "forgot" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Reset Password</h2>
                  <p className="text-sm text-slate-500 mt-2">Enter your email and we'll send you a link</p>
                </div>
                <ForgotPassword />
                <div className="text-center mt-6 pt-6 border-t border-slate-100">
                  <button onClick={() => setAuthMode("login")} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Back to login</button>
                </div>
              </div>
            )}

            {authMode === "reset" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Set New Password</h2>
                  <p className="text-sm text-slate-500 mt-2">Enter your new password below</p>
                </div>
                <ResetPassword />
                <div className="text-center mt-6 pt-6 border-t border-slate-100">
                  <button onClick={() => setAuthMode("login")} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Back to login</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Main App
  // ─────────────────────────────────────────────────────────────
  if (user?.must_change_password) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-100 text-amber-700 p-3 rounded-2xl">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Change Password Required</h1>
              <p className="text-sm text-slate-500">This temporary admin account must set a new password before continuing.</p>
            </div>
          </div>

          <form onSubmit={handleForcedPasswordChange} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">New password</label>
              <input
                type="password"
                value={forcedPassword.password}
                onChange={(e) => setForcedPassword((prev) => ({ ...prev, password: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <input
                type="password"
                value={forcedPassword.confirm}
                onChange={(e) => setForcedPassword((prev) => ({ ...prev, confirm: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                required
              />
            </div>

            {forcedPassword.error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm">
                {forcedPassword.error}
              </div>
            )}

            <button
              type="submit"
              disabled={forcedPassword.saving}
              className="w-full rounded-2xl bg-indigo-600 text-white font-bold py-3 hover:bg-indigo-700 disabled:opacity-60"
            >
              {forcedPassword.saving ? "Saving..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <Car className="text-white w-6 h-6" />
            </div>
            <span className="text-sm sm:text-xl font-bold tracking-tight text-slate-800 leading-tight">{SYSTEM_NAME}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">{user.role}</div>
              </div>
            </div>
            {(user.role === "admin" || user.role === "staff") && (
              <button onClick={() => setView(view === "user" ? "admin" : "user")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-sm font-semibold shadow-sm">
                {view === "user"
                  ? <><ShieldCheck className="w-4 h-4 text-indigo-600" /> แผงควบคุม</>
                  : <><User className="w-4 h-4 text-indigo-600" /> มุมมองผู้ใช้</>}
              </button>
            )}
            <button onClick={openSettings}
              className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="ตั้งค่าโปรไฟล์">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout}
              className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="ออกจากระบบ">
              <LogOut className="w-5 h-5" />
            </button>
            {isSupabaseOnline ? (
              <Wifi className="w-5 h-5 text-emerald-500" title="Supabase Connected" />
            ) : (
              <WifiOff className="w-5 h-5 text-rose-500" title="Supabase Disconnected" />
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {view === "user" ? (
          <div className="space-y-12">
            {/* Hero */}
            <section className="relative h-72 rounded-[2.5rem] overflow-hidden bg-indigo-950 flex items-center px-6 sm:px-10 lg:px-16 shadow-2xl">
              <div className="relative z-10 max-w-xl">
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6 leading-tight">
                  เทคโนโลยีนำทาง<br />สวัสดิการสร้างสุข
                </motion.h1>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="text-indigo-200 text-sm sm:text-lg lg:text-xl font-medium">
                  {SYSTEM_NAME}
                </motion.p>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-3/5 bg-gradient-to-l from-indigo-900 via-indigo-950/80 to-transparent z-0" />
              <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1200"
                className="absolute right-0 top-0 bottom-0 w-3/5 object-cover mix-blend-overlay opacity-60" alt="Hero" />
            </section>

            {/* Car Grid */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">รถยนต์ที่พร้อมให้บริการ</h2>
                  <p className="text-slate-500 mt-1">เลือกยานพาหนะที่เหมาะสมกับความต้องการของคุณ</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                  {["ทั้งหมด", "กระบะ", "เก๋ง", "ตู้"].map(t => (
                    <button key={t} onClick={() => setFilter(t)}
                      className={`px-6 py-2 rounded-xl border transition-all shadow-sm whitespace-nowrap text-sm font-semibold ${filter === t
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-indigo-200"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {cars.filter(car => {
                  if (filter === "ทั้งหมด") return true;
                  const typeMap: Record<string, string> = { กระบะ: "Truck", เก๋ง: "SUV", ตู้: "Van" };
                  return car.type === typeMap[filter];
                }).map(car => (
                  <motion.div layout key={car.id}
                    className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 hover:shadow-2xl transition-all duration-300 group flex flex-col">
                    <div className="relative h-56 overflow-hidden">
                      <img src={car.image} alt={car.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      <div className="absolute top-5 left-5 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-slate-800 shadow-sm">
                        {car.type === "Truck" ? "กระบะ" : car.type === "SUV" ? "เก๋ง" : car.type === "Van" ? "ตู้" : car.type}
                      </div>
                    </div>
                    <div className="p-8 flex-1 flex flex-col">
                      <h3 className="font-bold text-2xl text-slate-800 mb-4">{car.name}</h3>
                      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ตารางการใช้งาน</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                              className="p-1 rounded-md text-slate-400 hover:bg-white hover:text-slate-700 transition-all"
                              aria-label="เดือนก่อนหน้า"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-slate-400 min-w-[78px] text-center">
                              {calendarDate.toLocaleString("th-TH", { month: "long", year: "numeric" })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                              className="p-1 rounded-md text-slate-400 hover:bg-white hover:text-slate-700 transition-all"
                              aria-label="เดือนถัดไป"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => (
                            <div key={d} className="text-[8px] text-center font-bold text-slate-400">{d}</div>
                          ))}
                          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
                          {days.map(day => {
                            const booked = isDateBooked(day, car.id);
                            const pending = isDatePending(day, car.id);
                            return (
                              <div key={day} className={`h-4 rounded-sm flex items-center justify-center text-[8px] font-medium ${booked ? "bg-rose-500 text-white" : pending ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-400"}`}>
                                {day}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex gap-3 text-[8px] font-bold">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /> จองแล้ว</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> รออนุมัติ</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-200" /> ว่าง</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-slate-500 text-sm mb-4 mt-auto">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><Zap className="w-4 h-4 text-indigo-500" /> {car.license_plate || "ไม่ระบุ"}</div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><Users className="w-4 h-4 text-indigo-500" /> {car.seats || 5} ที่นั่ง</div>
                      </div>
                      {car.driver_name && (
                        <div className="mb-6 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs mb-1"><User className="w-3 h-3" /> พนักงานขับรถ</div>
                          <div className="text-sm font-bold text-slate-700">{car.driver_name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" /> {car.driver_tel || "ไม่ระบุ"}</div>
                        </div>
                      )}
                      <button onClick={() => { setSelectedCar(car); setIsBookingModalOpen(true); }}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 hover:shadow-indigo-200 flex items-center justify-center gap-2 group/btn">
                        จองรถคันนี้ <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* My Bookings */}
            {bookings.filter(b => b.user_id === user?.id).length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-indigo-600" /> การจองของฉัน
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">คำขอใช้รถยนต์ที่คุณส่งไว้</p>
                  </div>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-widest">
                          <th className="px-8 py-5 font-bold">รถยนต์ / ปลายทาง</th>
                          <th className="px-8 py-5 font-bold">วัน-เวลา</th>
                          <th className="px-8 py-5 font-bold">สถานะ</th>
                          <th className="px-8 py-5 font-bold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bookings.filter(b => b.user_id === user?.id).sort((a, b) => b.id - a.id).map((booking) => {
                          const statusMeta = getBookingStatusMeta(booking.status);
                          const canCancel = booking.status === "pending" || booking.status === "approved";

                          return (
                            <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-5">
                                <div className="font-bold text-slate-800">{booking.car_name}</div>
                                <div className="text-xs text-indigo-600 font-medium mt-1">{booking.destination || booking.objective}</div>
                                <div className="text-[10px] text-slate-400 mt-1">ผู้โดยสาร: {booking.passenger} ท่าน</div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="text-sm font-semibold text-slate-700">{booking.date_start}</div>
                                <div className="text-xs text-slate-400">{booking.time_start} - {booking.time_finish} น.</div>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusMeta.badgeClass}`}>
                                  {statusMeta.label}
                                </span>
                                {booking.status === "approved" && booking.driver_name && (
                                  <div className="text-[10px] text-emerald-600 font-bold mt-1">คนขับ: {booking.driver_name}</div>
                                )}
                                {booking.status === "rejected" && booking.reject_reason && (
                                  <div className="text-[10px] text-rose-500 italic mt-1 max-w-[160px]">เหตุผล: {booking.reject_reason}</div>
                                )}
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col items-center gap-2">
                                  {booking.status !== "rejected" && booking.status !== "cancelled" && (
                                    <button
                                      onClick={() => exportPDF(booking)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all font-bold text-xs border border-indigo-100"
                                    >
                                      <Download className="w-3.5 h-3.5" /> ดาวน์โหลด PDF
                                    </button>
                                  )}
                                  {canCancel && (
                                    <button
                                      onClick={() => handleCancelBooking(booking)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all font-bold text-xs border border-rose-100"
                                    >
                                      <XCircle className="w-3.5 h-3.5" /> ยกเลิกการจอง
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Admin Panel */
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-extrabold text-slate-800 flex items-center gap-4">
                <LayoutDashboard className="w-10 h-10 text-indigo-600" /> แผงควบคุมผู้ดูแล
              </h1>
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                {(user.role === "admin" || user.role === "staff") && (
                  <button onClick={() => setAdminTab("approvals")}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${adminTab === "approvals" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                    การอนุมัติใช้รถ
                  </button>
                )}
                <button onClick={() => setAdminTab("bookings")}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${adminTab === "bookings" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                  ประวัติการจอง
                </button>
                {user.role === "admin" && (<>
                  <button onClick={() => setAdminTab("cars")}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${adminTab === "cars" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                    จัดการรถยนต์
                  </button>
                  <button onClick={() => setAdminTab("drivers")}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${adminTab === "drivers" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                    จัดการคนขับ
                  </button>
                  <button onClick={() => { setAdminTab("users"); fetchAllUsers(); }}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${adminTab === "users" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                    จัดการผู้ใช้
                  </button>
                </>)}
              </div>
            </div>

            <div className="space-y-10">
              {/* Approvals */}
              {adminTab === "approvals" && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-amber-50/30">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><Clock className="w-7 h-7 text-amber-500" /> คำขอที่รอการอนุมัติ</h2>
                    <span className="bg-amber-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-amber-100">
                      รออนุมัติ {bookings.filter(b => b.status === "pending").length} รายการ
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-widest">
                          <th className="px-8 py-5 font-bold">ผู้ขอใช้ / ตำแหน่ง</th>
                          <th className="px-8 py-5 font-bold">รถยนต์ / วัตถุประสงค์</th>
                          <th className="px-8 py-5 font-bold">วัน-เวลา</th>
                          <th className="px-8 py-5 font-bold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bookings.filter(b => b.status === "pending").length === 0 ? (
                          <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">ไม่มีคำขอที่รอการอนุมัติในขณะนี้</td></tr>
                        ) : bookings.filter(b => b.status === "pending").map(booking => (
                          <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-800">{booking.user_name}</div>
                              <div className="text-xs text-indigo-600 font-bold mt-1">{booking.user_organization}</div>
                              <div className="text-[10px] text-slate-500 mt-1">{booking.user_position}</div>
                              <div className="text-xs text-slate-400 mt-1">{booking.tel}</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-800">{booking.car_name}</div>
                              <div className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{booking.objective}"</div>
                              <div className="text-[10px] text-slate-400 mt-1">ผู้โดยสาร: {booking.passenger} ท่าน</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="text-sm font-semibold text-slate-700">{booking.date_start} ถึง {booking.date_finish}</div>
                              <div className="text-xs text-slate-400 mt-1">{booking.time_start} - {booking.time_finish} น.</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-3">
                                <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                                  <option value="">เลือกพนักงานขับรถ</option>
                                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => { if (!selectedDriverId) { alert("กรุณาเลือกพนักงานขับรถก่อนอนุมัติ"); return; } handleUpdateBookingStatus(booking.id, "approved", undefined, selectedDriverId); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all font-bold text-xs border border-emerald-100">
                                    <CheckCircle className="w-4 h-4" /> อนุมัติ
                                  </button>
                                  <button onClick={() => setRejectingBookingId(booking.id)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all font-bold text-xs border border-rose-100">
                                    <XCircle className="w-4 h-4" /> ปฏิเสธ
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Booking History */}
              {adminTab === "bookings" && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-7 h-7 text-indigo-600" />
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800">ประวัติการจองทั้งหมด</h2>
                        <p className="text-xs text-slate-500 mt-1">รายการจองรถยนต์ทั้งหมดในระบบ</p>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                      {["ทั้งหมด", "รอดำเนินการ", "อนุมัติแล้ว", "ปฏิเสธ", "ยกเลิกแล้ว"].map(s => (
                        <button key={s} onClick={() => setBookingStatusFilter(s)}
                          className={`px-4 py-2 rounded-xl border transition-all text-xs font-bold whitespace-nowrap ${bookingStatusFilter === s ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-widest">
                          <th className="px-8 py-5 font-bold">ผู้ขอใช้ / ตำแหน่ง</th>
                          <th className="px-8 py-5 font-bold">รถยนต์ / วัตถุประสงค์</th>
                          <th className="px-8 py-5 font-bold">วัน-เวลา</th>
                          <th className="px-8 py-5 font-bold">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bookings.filter(b => {
                          if (bookingStatusFilter === "ทั้งหมด") return true;
                          const m: Record<string, Booking["status"]> = {
                            รอดำเนินการ: "pending",
                            อนุมัติแล้ว: "approved",
                            ปฏิเสธ: "rejected",
                            ยกเลิกแล้ว: "cancelled",
                          };
                          return b.status === m[bookingStatusFilter];
                        }).map((booking) => {
                          const statusMeta = getBookingStatusMeta(booking.status);

                          return (
                            <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-8 py-6">
                                <div className="font-bold text-slate-800">{booking.user_name}</div>
                                <div className="text-xs text-indigo-600 font-bold mt-1">{booking.user_organization}</div>
                                <div className="text-[10px] text-slate-500 mt-1">{booking.user_position}</div>
                                <div className="text-xs text-slate-400 mt-1">{booking.tel}</div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="font-bold text-slate-800">{booking.car_name}</div>
                                <div className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{booking.objective}"</div>
                                <div className="text-[10px] text-slate-400 mt-1">ผู้โดยสาร: {booking.passenger} ท่าน</div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="text-sm font-semibold text-slate-700">{booking.date_start} ถึง {booking.date_finish}</div>
                                <div className="text-xs text-slate-400 mt-1">{booking.time_start} - {booking.time_finish} น.</div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${statusMeta.badgeClass}`}>
                                    {statusMeta.label}
                                  </span>
                                  {booking.status === "approved" && <div className="text-[10px] text-emerald-600 font-bold mt-1">คนขับ: {booking.driver_name}</div>}
                                  {booking.status === "rejected" && booking.reject_reason && <div className="text-[10px] text-rose-500 italic max-w-[150px] truncate">เหตุผล: {booking.reject_reason}</div>}
                                  {booking.status === "approved" && (user.role === "admin" || user.role === "staff") && (
                                    <button onClick={() => exportPDF(booking)}
                                      className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all font-bold text-[10px] border border-indigo-100 w-fit">
                                      <Download className="w-3 h-3" /> พิมพ์ใบอนุญาต
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cars Management */}
              {adminTab === "cars" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 h-fit">
                    <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                      <div className="bg-indigo-50 p-2 rounded-lg"><Plus className="w-6 h-6 text-indigo-600" /></div> เพิ่มรถยนต์ใหม่
                    </h2>
                    <form onSubmit={handleAddCar} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อรถ</label>
                          <input type="text" required value={newCar.name} onChange={e => setNewCar({ ...newCar, name: e.target.value })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="เช่น Toyota Camry" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">เลขทะเบียน</label>
                          <input type="text" required value={newCar.license_plate} onChange={e => setNewCar({ ...newCar, license_plate: e.target.value })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="เช่น กข 1234" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">ประเภท</label>
                          <select value={newCar.type} onChange={e => setNewCar({ ...newCar, type: e.target.value })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                            <option value="">เลือกประเภท</option>
                            <option value="Truck">กระบะ</option>
                            <option value="SUV">เก๋ง</option>
                            <option value="Van">ตู้</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">จำนวนที่นั่ง</label>
                          <input type="number" required value={newCar.seats} onChange={e => setNewCar({ ...newCar, seats: parseInt(e.target.value) })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">พนักงานขับรถ</label>
                        <select value={newCar.driver_id} onChange={e => setNewCar({ ...newCar, driver_id: e.target.value })}
                          className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                          <option value="">ไม่ระบุ</option>
                          {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">รูปภาพรถยนต์</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 relative">
                            <input type="file" accept="image/*" onChange={e => handleFileUpload(e, b => setNewCar({ ...newCar, image: b }))} className="hidden" id="car-image-upload" />
                            <label htmlFor="car-image-upload" className="w-full px-5 py-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer flex items-center justify-center gap-2 transition-all text-slate-500 font-medium">
                              <Camera className="w-5 h-5" /> {newCar.image ? "เปลี่ยนรูปภาพ" : "อัปโหลดรูปภาพ"}
                            </label>
                          </div>
                          {newCar.image && <img src={newCar.image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Preview" />}
                        </div>
                      </div>
                      <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">บันทึกข้อมูลรถยนต์</button>
                    </form>
                  </div>
                  <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50"><h2 className="text-2xl font-bold text-slate-800">การจัดการคลังรถยนต์</h2></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-8">
                      {cars.map(car => (
                        <div key={car.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group">
                          <div className="flex items-center gap-4">
                            <img src={car.image} className="w-16 h-16 rounded-xl object-cover shadow-md" alt={car.name} />
                            <div>
                              <p className="font-bold text-slate-800">{car.name}</p>
                              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{car.license_plate}</p>
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{car.type} | {car.seats} ที่นั่ง</p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => setEditingCar(car)} className="p-3 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"><Settings className="w-5 h-5" /></button>
                            <button onClick={() => handleDeleteCar(car.id)} className="p-3 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Users Management (admin only) */}
              {adminTab === "users" && user.role === "admin" && (() => {
                const filteredUsers = allUsers.filter(u => {
                  const q = userSearchQ.toLowerCase();
                  const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                  const matchRole = userRoleFilter === "ทั้งหมด" || u.role === userRoleFilter;
                  const matchStatus = userStatusFilter === "ทั้งหมด"
                    || (userStatusFilter === "เปิดใช้งาน" && u.is_active)
                    || (userStatusFilter === "ปิดใช้งาน" && !u.is_active);
                  return matchQ && matchRole && matchStatus;
                });

                const roleLabel = (r: string) => r === "admin" ? "ผู้ดูแล" : r === "staff" ? "เจ้าหน้าที่" : "ผู้ใช้";
                const roleBadge = (r: string) => r === "admin"
                  ? "bg-rose-100 text-rose-700"
                  : r === "staff" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600";

                return (
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <Users className="w-7 h-7 text-indigo-600" />
                        <div>
                          <h2 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้งาน</h2>
                          <p className="text-xs text-slate-500 mt-1">ผู้ใช้ทั้งหมด {allUsers.length} บัญชี</p>
                        </div>
                      </div>
                      <button onClick={() => setCreatingUser(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm">
                        <Plus className="w-4 h-4" /> สร้างผู้ใช้ใหม่
                      </button>
                    </div>

                    {/* Search & Filter */}
                    <div className="px-8 py-5 border-b border-slate-50 flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={userSearchQ} onChange={e => setUserSearchQ(e.target.value)}
                          placeholder="ค้นหาชื่อหรืออีเมล..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {["ทั้งหมด", "admin", "staff", "user"].map(r => (
                          <button key={r} onClick={() => setUserRoleFilter(r)}
                            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${userRoleFilter === r ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-400"}`}>
                            {r === "ทั้งหมด" ? "ทุกบทบาท" : roleLabel(r)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {["ทั้งหมด", "เปิดใช้งาน", "ปิดใช้งาน"].map(s => (
                          <button key={s} onClick={() => setUserStatusFilter(s)}
                            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${userStatusFilter === s ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-400"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-widest">
                            <th className="px-6 py-4 font-bold">ชื่อ / อีเมล</th>
                            <th className="px-6 py-4 font-bold">ตำแหน่ง / หน่วยงาน</th>
                            <th className="px-6 py-4 font-bold">บทบาท</th>
                            <th className="px-6 py-4 font-bold">สถานะ</th>
                            <th className="px-6 py-4 font-bold text-center">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">ไม่พบผู้ใช้</td></tr>
                          ) : filteredUsers.map(u => (
                            <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${!u.is_active ? "opacity-60" : ""}`}>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.is_active ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>
                                    {u.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                      {u.name}
                                      {u.id === user?.id && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">ฉัน</span>}
                                    </div>
                                    <div className="text-xs text-slate-400">{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-700">{u.position || "–"}</div>
                                <div className="text-xs text-slate-400">{u.organization || "–"}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${roleBadge(u.role)}`}>
                                  {roleLabel(u.role)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {u.is_active
                                  ? <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> เปิดใช้งาน</span>
                                  : <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> ปิดใช้งาน</span>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => openEditUser(u)} title="แก้ไข"
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleAdminToggleActive(u)}
                                    title={u.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                                    className={`p-2 rounded-xl transition-all ${u.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                                    {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                  </button>
                                  {u.id !== user?.id && (
                                    <button onClick={() => handleAdminDeleteUser(u)} title="ลบผู้ใช้"
                                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Drivers Management */}
              {adminTab === "drivers" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 h-fit">
                    <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                      <div className="bg-indigo-50 p-2 rounded-lg"><Plus className="w-6 h-6 text-indigo-600" /></div> เพิ่มพนักงานขับรถ
                    </h2>
                    <form onSubmit={handleAddDriver} className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อ-นามสกุล</label>
                        <input type="text" required value={newDriver.name} onChange={e => setNewDriver({ ...newDriver, name: e.target.value })}
                          className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="ระบุชื่อ-นามสกุล" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทรศัพท์</label>
                        <input type="tel" required value={newDriver.tel} onChange={e => setNewDriver({ ...newDriver, tel: e.target.value })}
                          className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="08x-xxx-xxxx" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">รูปภาพพนักงานขับรถ</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 relative">
                            <input type="file" accept="image/*" onChange={e => handleFileUpload(e, b => setNewDriver({ ...newDriver, image: b }))} className="hidden" id="driver-image-upload" />
                            <label htmlFor="driver-image-upload" className="w-full px-5 py-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer flex items-center justify-center gap-2 transition-all text-slate-500 font-medium">
                              <Camera className="w-5 h-5" /> {newDriver.image ? "เปลี่ยนรูปภาพ" : "อัปโหลดรูปภาพ"}
                            </label>
                          </div>
                          {newDriver.image && <img src={newDriver.image} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="Preview" />}
                        </div>
                      </div>
                      <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">บันทึกข้อมูลพนักงานขับรถ</button>
                    </form>
                  </div>
                  <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50"><h2 className="text-2xl font-bold text-slate-800">รายชื่อพนักงานขับรถ</h2></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-8">
                      {drivers.map(driver => (
                        <div key={driver.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group">
                          <div className="flex items-center gap-4">
                            {driver.image ? <img src={driver.image} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt={driver.name} /> : <div className="bg-indigo-100 p-3 rounded-xl"><User className="w-6 h-6 text-indigo-600" /></div>}
                            <div>
                              <p className="font-bold text-slate-800">{driver.name}</p>
                              <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> {driver.tel}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => setEditingDriver(driver)} className="p-3 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"><Settings className="w-5 h-5" /></button>
                            <button onClick={() => handleDeleteDriver(driver.id)} className="p-3 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && selectedCar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBookingModalOpen(false)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="relative bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="relative h-64">
                <img src={selectedCar.image} className="w-full h-full object-cover" alt={selectedCar.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-10 left-10 text-white">
                  <h2 className="text-4xl font-extrabold mb-2">{selectedCar.name}</h2>
                  <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-widest text-sm"><ShieldCheck className="w-4 h-4" /> แบบฟอร์มขอใช้รถยนต์ส่วนกลาง</div>
                </div>
                <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-8 right-8 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition-all"><XCircle className="w-6 h-6" /></button>
              </div>
              <div className="p-10 space-y-10">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><User className="w-5 h-5 text-indigo-600" /> ข้อมูลผู้ขอใช้รถ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">ชื่อ-นามสกุล</label>
                      <input type="text" required value={formData.user_name} onChange={e => setFormData({ ...formData, user_name: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="ระบุชื่อ-นามสกุล" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">ตำแหน่ง</label>
                      <input type="text" value={formData.user_position} onChange={e => setFormData({ ...formData, user_position: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="ระบุตำแหน่ง" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">กลุ่มงาน/ฝ่าย</label>
                      <input type="text" value={formData.user_organization} onChange={e => setFormData({ ...formData, user_organization: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="ระบุกลุ่มงาน" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">เบอร์โทรศัพท์</label>
                      <input type="tel" value={formData.tel} onChange={e => setFormData({ ...formData, tel: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="08x-xxx-xxxx" />
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><Calendar className="w-5 h-5 text-indigo-600" /> รายละเอียดการเดินทาง</h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">ขออนุญาตใช้รถยนต์ (ไปที่ไหน)</label>
                      <input type="text" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="ระบุสถานที่ปลายทาง เช่น กระทรวงแรงงาน ถนนมิตรไมตรี" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 ml-1">เพื่อ (วัตถุประสงค์)</label>
                      <textarea rows={2} value={formData.objective} onChange={e => setFormData({ ...formData, objective: e.target.value })}
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                        placeholder="ระบุวัตถุประสงค์ เช่น ส่งเอกสารราชการ / ประชุมหน่วยงาน" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">จำนวนผู้โดยสาร (ท่าน)</label>
                        <input type="number" min={1} value={formData.passenger} onChange={e => setFormData({ ...formData, passenger: parseInt(e.target.value) })}
                          className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">หมายเหตุเพิ่มเติม</label>
                        <input type="text" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}
                          className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          placeholder="ระบุหมายเหตุ (ถ้ามี)" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">วันที่เริ่ม</label>
                        <input type="date" value={formData.date_start} onChange={e => setFormData({ ...formData, date_start: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">เวลาเริ่ม (24 ชม.)</label>
                        <input type="time" value={formData.time_start} onChange={e => setFormData({ ...formData, time_start: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">วันที่สิ้นสุด</label>
                        <input type="date" value={formData.date_finish} onChange={e => setFormData({ ...formData, date_finish: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">เวลาสิ้นสุด (24 ชม.)</label>
                        <input type="time" value={formData.time_finish} onChange={e => setFormData({ ...formData, time_finish: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button onClick={() => setIsBookingModalOpen(false)} className="flex-1 px-8 py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">ยกเลิก</button>
                  <button onClick={handleBooking} className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">ยืนยันการส่งคำขอจอง</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Car Modal */}
      <AnimatePresence>
        {editingCar && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingCar(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="relative bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-3xl font-extrabold text-slate-800 mb-8 flex items-center gap-3"><Settings className="w-8 h-8 text-indigo-600" /> แก้ไขข้อมูลรถยนต์</h3>
              <form onSubmit={handleUpdateCar} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อรถ</label>
                    <input type="text" required value={editingCar.name} onChange={e => setEditingCar({ ...editingCar, name: e.target.value })}
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">เลขทะเบียน</label>
                    <input type="text" required value={editingCar.license_plate} onChange={e => setEditingCar({ ...editingCar, license_plate: e.target.value })}
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ประเภท</label>
                    <select value={editingCar.type} onChange={e => setEditingCar({ ...editingCar, type: e.target.value })}
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                      <option value="Truck">กระบะ</option>
                      <option value="SUV">เก๋ง</option>
                      <option value="Van">ตู้</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">จำนวนที่นั่ง</label>
                    <input type="number" required value={editingCar.seats} onChange={e => setEditingCar({ ...editingCar, seats: parseInt(e.target.value) })}
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รูปภาพรถยนต์</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, b => setEditingCar({ ...editingCar, image: b }))} className="hidden" id="edit-car-image-upload" />
                      <label htmlFor="edit-car-image-upload" className="w-full px-5 py-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer flex items-center justify-center gap-2 transition-all text-slate-500 font-medium">
                        <Camera className="w-5 h-5" /> เปลี่ยนรูปภาพ
                      </label>
                    </div>
                    <img src={editingCar.image} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" alt="Preview" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingCar(null)} className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">ยกเลิก</button>
                  <button type="submit" className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">บันทึกการแก้ไข</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Driver Modal */}
      <AnimatePresence>
        {editingDriver && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingDriver(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="relative bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
              <h3 className="text-2xl font-extrabold text-slate-800 mb-8 flex items-center gap-3"><Settings className="w-6 h-6 text-indigo-600" /> แก้ไขข้อมูลคนขับ</h3>
              <form onSubmit={handleUpdateDriver} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อ-นามสกุล</label>
                  <input type="text" required value={editingDriver.name} onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })}
                    className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทรศัพท์</label>
                  <input type="tel" required value={editingDriver.tel} onChange={e => setEditingDriver({ ...editingDriver, tel: e.target.value })}
                    className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รูปภาพพนักงานขับรถ</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, b => setEditingDriver({ ...editingDriver, image: b }))} className="hidden" id="edit-driver-image-upload" />
                      <label htmlFor="edit-driver-image-upload" className="w-full px-5 py-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer flex items-center justify-center gap-2 transition-all text-slate-500 font-medium">
                        <Camera className="w-5 h-5" /> เปลี่ยนรูปภาพ
                      </label>
                    </div>
                    {editingDriver.image && <img src={editingDriver.image} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" alt="Preview" />}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingDriver(null)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">ยกเลิก</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">บันทึกการแก้ไข</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {rejectingBookingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectingBookingId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">ระบุเหตุผลที่ปฏิเสธ</h3>
              <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all resize-none mb-6"
                placeholder="ระบุเหตุผลในการปฏิเสธคำขอจอง..." />
              <div className="flex gap-3">
                <button onClick={() => setRejectingBookingId(null)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">ยกเลิก</button>
                <button onClick={() => handleUpdateBookingStatus(rejectingBookingId, "rejected", rejectReason)}
                  className="flex-1 px-6 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">ยืนยันการปฏิเสธ</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-indigo-600 p-2 rounded-lg"><Car className="text-white w-6 h-6" /></div>
            <span className="text-lg sm:text-2xl font-bold tracking-tight text-slate-800">{SYSTEM_NAME}</span>
          </div>
          <p className="text-sm sm:text-base text-slate-500 font-medium">{SYSTEM_NAME}</p>
          <div className="mt-8 pt-8 border-t border-slate-100 text-slate-400 text-sm">© 2024 {SYSTEM_NAME}. สงวนลิขสิทธิ์.</div>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-8 border-b border-slate-100 flex items-center gap-4">
                <div className="bg-indigo-50 p-3 rounded-2xl"><Settings className="w-6 h-6 text-indigo-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าโปรไฟล์</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{user?.email}</p>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="ml-auto p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><XCircle className="w-5 h-5" /></button>
              </div>

              {/* Account info */}
              <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">{user?.name.charAt(0)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${user?.role === "admin" ? "bg-rose-100 text-rose-700" : user?.role === "staff" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                      {user?.role === "admin" ? "ผู้ดูแลระบบ" : user?.role === "staff" ? "เจ้าหน้าที่" : "ผู้ใช้ทั่วไป"}
                    </span>
                    {user?.is_active !== false
                      ? <span className="text-[10px] text-emerald-600 font-bold">● เปิดใช้งาน</span>
                      : <span className="text-[10px] text-red-500 font-bold">● ปิดใช้งาน</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">รหัสบัญชี: {user?.id?.slice(0, 8)}…</div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Profile edit form */}
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <h3 className="text-base font-bold text-slate-700 flex items-center gap-2"><User className="w-4 h-4 text-indigo-500" /> ข้อมูลส่วนตัว</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">ชื่อ-นามสกุล</label>
                      <input type="text" required value={settingsProfileForm.name} onChange={e => setSettingsProfileForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">ตำแหน่ง</label>
                      <input type="text" value={settingsProfileForm.position} onChange={e => setSettingsProfileForm(p => ({ ...p, position: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">กลุ่มงาน/หน่วยงาน</label>
                      <input type="text" value={settingsProfileForm.organization} onChange={e => setSettingsProfileForm(p => ({ ...p, organization: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์ภายใน</label>
                      <input type="text" value={settingsProfileForm.internal_tel} onChange={e => setSettingsProfileForm(p => ({ ...p, internal_tel: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์มือถือ</label>
                      <input type="text" value={settingsProfileForm.mobile_tel} onChange={e => setSettingsProfileForm(p => ({ ...p, mobile_tel: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                    </div>
                  </div>
                  <button type="submit" disabled={settingsProfileSaving}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm disabled:opacity-60">
                    {settingsProfileSaving ? "กำลังบันทึก..." : "บันทึกข้อมูลส่วนตัว"}
                  </button>
                </form>

                <div className="border-t border-slate-100 pt-6">
                  <form onSubmit={handleChangeOwnPassword} className="space-y-4">
                    <h3 className="text-base font-bold text-slate-700 flex items-center gap-2"><KeyRound className="w-4 h-4 text-indigo-500" /> เปลี่ยนรหัสผ่าน</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">รหัสผ่านใหม่</label>
                        <input type="password" minLength={6} value={settingsPwForm.password}
                          onChange={e => setSettingsPwForm(p => ({ ...p, password: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="อย่างน้อย 6 ตัวอักษร" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">ยืนยันรหัสผ่านใหม่</label>
                        <input type="password" value={settingsPwForm.confirm}
                          onChange={e => setSettingsPwForm(p => ({ ...p, confirm: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="ระบุอีกครั้ง" />
                      </div>
                    </div>
                    {settingsPwForm.error && <p className="text-xs text-rose-600 font-medium">{settingsPwForm.error}</p>}
                    <button type="submit" disabled={settingsPwForm.saving}
                      className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all text-sm disabled:opacity-60">
                      {settingsPwForm.saving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {creatingUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreatingUser(false)} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative bg-white w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-3"><UserPlus className="w-7 h-7 text-indigo-600" /> สร้างผู้ใช้ใหม่</h3>
              <p className="text-sm text-slate-500 mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3">ผู้ใช้ใหม่จะต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก</p>
              <form onSubmit={handleAdminCreateUser} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">อีเมล <span className="text-rose-500">*</span></label>
                    <input type="email" required value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="name@example.com" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">รหัสผ่านชั่วคราว <span className="text-rose-500">*</span></label>
                    <input type="text" required minLength={6} value={newUserForm.password} onChange={e => setNewUserForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="อย่างน้อย 6 ตัวอักษร" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                    <input type="text" required value={newUserForm.name} onChange={e => setNewUserForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">บทบาท</label>
                    <select value={newUserForm.role} onChange={e => setNewUserForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                      <option value="user">ผู้ใช้ทั่วไป</option>
                      <option value="staff">เจ้าหน้าที่</option>
                      <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">ตำแหน่ง</label>
                    <input type="text" value={newUserForm.position} onChange={e => setNewUserForm(p => ({ ...p, position: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">กลุ่มงาน/หน่วยงาน</label>
                    <input type="text" value={newUserForm.organization} onChange={e => setNewUserForm(p => ({ ...p, organization: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์ภายใน</label>
                    <input type="text" value={newUserForm.internal_tel} onChange={e => setNewUserForm(p => ({ ...p, internal_tel: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์มือถือ</label>
                    <input type="text" value={newUserForm.mobile_tel} onChange={e => setNewUserForm(p => ({ ...p, mobile_tel: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setCreatingUser(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm">ยกเลิก</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all text-sm shadow-lg shadow-indigo-100">สร้างบัญชีผู้ใช้</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingUser(null)} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }} className="relative bg-white w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-extrabold text-slate-800 mb-2 flex items-center gap-3"><Edit2 className="w-6 h-6 text-indigo-600" /> แก้ไขข้อมูลผู้ใช้</h3>
              <p className="text-sm text-slate-400 mb-6">{editingUser.email}</p>
              <form onSubmit={handleAdminUpdateUser} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">ชื่อ-นามสกุล</label>
                    <input type="text" required value={editUserForm.name} onChange={e => setEditUserForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">บทบาท</label>
                    {editingUser.id === user?.id ? (
                      <div className="px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500">ไม่สามารถเปลี่ยนบทบาทของตัวเองได้</div>
                    ) : (
                      <select value={editUserForm.role} onChange={e => setEditUserForm(p => ({ ...p, role: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                        <option value="user">ผู้ใช้ทั่วไป</option>
                        <option value="staff">เจ้าหน้าที่</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">ตำแหน่ง</label>
                    <input type="text" value={editUserForm.position} onChange={e => setEditUserForm(p => ({ ...p, position: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">กลุ่มงาน/หน่วยงาน</label>
                    <input type="text" value={editUserForm.organization} onChange={e => setEditUserForm(p => ({ ...p, organization: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์ภายใน</label>
                    <input type="text" value={editUserForm.internal_tel} onChange={e => setEditUserForm(p => ({ ...p, internal_tel: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โทรศัพท์มือถือ</label>
                    <input type="text" value={editUserForm.mobile_tel} onChange={e => setEditUserForm(p => ({ ...p, mobile_tel: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                </div>

                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editUserForm.is_active}
                      onChange={e => setEditUserForm(p => ({ ...p, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded accent-indigo-600" />
                    <span className="text-sm font-medium text-slate-700">เปิดใช้งาน</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editUserForm.must_change_password}
                      onChange={e => setEditUserForm(p => ({ ...p, must_change_password: e.target.checked }))}
                      className="w-4 h-4 rounded accent-amber-500" />
                    <span className="text-sm font-medium text-slate-700">บังคับเปลี่ยนรหัสผ่าน</span>
                  </label>
                </div>

                {editUserForm.role === "admin" && editingUser.role !== "admin" && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 font-medium">กำลังเลื่อนตำแหน่งผู้ใช้นี้เป็น ผู้ดูแลระบบ — ตรวจสอบให้แน่ใจก่อนบันทึก</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm">ยกเลิก</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all text-sm shadow-lg shadow-indigo-100">บันทึกการแก้ไข</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden PDF Template */}
      {pdfBooking && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -9999, pointerEvents: "none" }}>
          <BookingPdfTemplate ref={pdfTemplateRef} booking={pdfBooking} />
        </div>
      )}
    </div>
  );
}
