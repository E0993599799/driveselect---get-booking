import * as React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfBooking {
  id: number;
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
  note?: string;
  date_start: string;
  date_finish: string;
  time_start: string;
  time_finish: string;
  status: "pending" | "approved" | "rejected";
  driver_name?: string;
}

interface Props {
  booking: PdfBooking;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function getThaiDate() {
  const now = new Date();
  return {
    day: now.getDate(),
    month: THAI_MONTHS[now.getMonth()],
    year: now.getFullYear() + 543,
  };
}

/** Returns true if booking's car type matches the given category */
function matchCarType(carType: string, category: "suv" | "truck" | "van"): boolean {
  const t = (carType || "").toLowerCase();
  if (category === "suv")   return t === "suv"   || t === "sedan" || t === "เก๋ง";
  if (category === "truck") return t === "truck" || t === "pickup" || t === "กระบะ";
  if (category === "van")   return t === "van"   || t === "ตู้";
  return false;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ROOT: React.CSSProperties = {
  width: "794px",
  minHeight: "1123px",
  backgroundColor: "#ffffff",
  fontFamily: "'Sarabun', sans-serif",
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#000000",
  padding: "48px 56px",
  boxSizing: "border-box",
};

const LINE: React.CSSProperties = {
  display: "inline-block",
  borderBottom: "1px solid #000",
  paddingBottom: "2px",
};

const FLEX_ROW: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "baseline",
  marginBottom: "12px",
  flexWrap: "wrap" as const,
};

const GROW: React.CSSProperties = { flex: 1, ...LINE };

const CHECKBOX: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  border: "1px solid #000",
  fontSize: "11px",
  flexShrink: 0,
  marginRight: "4px",
};

const HR: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #000",
  margin: "24px 0",
};

// ─── Component ────────────────────────────────────────────────────────────────

const BookingPdfTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ booking }, ref) => {
    const { day, month, year } = getThaiDate();

    const isSuv   = matchCarType(booking.car_type, "suv");
    const isTruck = matchCarType(booking.car_type, "truck");
    const isVan   = matchCarType(booking.car_type, "van");

    // Destination: use dedicated field if available, fall back to objective
    const destination = booking.destination || booking.objective || "";

    return (
      <div ref={ref} style={ROOT}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>
            กรมสวัสดิการและคุ้มครองแรงงาน
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, textDecoration: "underline", marginTop: "4px" }}>
            ใบขออนุญาตใช้รถยนต์
          </div>
        </div>

        {/* ── Date (right-aligned) ── */}
        <div style={{ textAlign: "right", marginBottom: "20px" }}>
          {"วันที่ "}
          <span style={{ ...LINE, padding: "0 12px" }}>{day}</span>
          {" เดือน "}
          <span style={{ ...LINE, padding: "0 12px" }}>{month}</span>
          {" พ.ศ. "}
          <span style={{ ...LINE, padding: "0 12px" }}>{year}</span>
        </div>

        {/* ── To ── */}
        <div style={{ marginBottom: "14px" }}>
          เรียน ผู้อำนวยการกองการเจ้าหน้าที่
        </div>

        {/* ── Name / Position ── */}
        <div style={FLEX_ROW}>
          <span style={{ whiteSpace: "nowrap" }}>ข้าพเจ้า</span>
          <span style={{ ...GROW, minWidth: "140px" }}>{booking.user_name}</span>
          <span style={{ whiteSpace: "nowrap" }}>ตำแหน่ง</span>
          <span style={{ ...GROW, minWidth: "140px" }}>{booking.user_position}</span>
        </div>

        {/* ── Organization ── */}
        <div style={FLEX_ROW}>
          <span style={{ whiteSpace: "nowrap" }}>กลุ่มงาน/งาน</span>
          <span style={GROW}>{booking.user_organization}</span>
        </div>

        {/* ── Destination (ไปที่ไหน) ── */}
        <div style={FLEX_ROW}>
          <span style={{ whiteSpace: "nowrap" }}>ขออนุญาตใช้รถยนต์ (ไปที่ไหน)</span>
          <span style={GROW}>{destination}</span>
        </div>

        {/* ── Purpose + Passengers ── */}
        <div style={FLEX_ROW}>
          <span style={{ whiteSpace: "nowrap" }}>เพื่อ</span>
          <span style={GROW}>{booking.objective}</span>
          <span style={{ whiteSpace: "nowrap" }}>มีคนนั่ง</span>
          <span style={{ ...LINE, padding: "0 16px" }}>{booking.passenger}</span>
          <span>คน</span>
        </div>

        {/* ── Date / Time range ── */}
        <div style={FLEX_ROW}>
          <span style={{ whiteSpace: "nowrap" }}>ในวันที่</span>
          <span style={{ ...LINE, padding: "0 10px" }}>{booking.date_start}</span>
          <span style={{ whiteSpace: "nowrap" }}>เวลา</span>
          <span style={{ ...LINE, padding: "0 10px" }}>{booking.time_start}</span>
          <span style={{ whiteSpace: "nowrap" }}>ถึงวันที่</span>
          <span style={{ ...LINE, padding: "0 10px" }}>{booking.date_finish}</span>
          <span style={{ whiteSpace: "nowrap" }}>เวลา</span>
          <span style={{ ...LINE, padding: "0 10px" }}>{booking.time_finish}</span>
          <span>น.</span>
        </div>

        {/* ── Contact ── */}
        <div style={{ ...FLEX_ROW, marginBottom: "28px" }}>
          <span style={{ whiteSpace: "nowrap" }}>เบอร์ติดต่อ</span>
          <span style={{ ...LINE, padding: "0 20px" }}>{booking.tel}</span>
        </div>

        {/* ── Requester Signature ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <div style={{ textAlign: "center", minWidth: "260px" }}>
            <div>ลงชื่อ ........................................... ผู้ขออนุญาต</div>
            <div style={{ marginTop: "8px" }}>({booking.user_name})</div>
          </div>
        </div>

        {/* ── Divider ── */}
        <hr style={HR} />

        {/* ── Vehicle Approval Section ── */}
        <div style={{ marginBottom: "16px", fontWeight: 700 }}>
          เห็นควรอนุญาตให้ใช้รถ
        </div>

        {/* Vehicle type rows */}
        {(
          [
            { label: "รถเก๋ง",   checked: isSuv,   reg: isSuv   ? booking.car_license : "" },
            { label: "รถกระบะ",  checked: isTruck, reg: isTruck ? booking.car_license : "" },
            { label: "รถตู้",    checked: isVan,   reg: isVan   ? booking.car_license : "" },
          ] as const
        ).map(({ label, checked, reg }) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: "8px",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={CHECKBOX}>{checked ? "✓" : ""}</span>
              <span>{label}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
              <span style={{ whiteSpace: "nowrap" }}>หมายเลขทะเบียน</span>
              <span style={{ ...GROW }}>{reg}</span>
              <span>กทม.</span>
            </div>
          </div>
        ))}

        {/* ── Driver Assignment ── */}
        <div style={{ ...FLEX_ROW, marginTop: "8px", marginBottom: "28px" }}>
          <span style={{ whiteSpace: "nowrap" }}>โดยมอบหมายให้</span>
          <span style={GROW}>{booking.driver_name || ""}</span>
          <span style={{ whiteSpace: "nowrap" }}>เป็นพนักงานขับรถยนต์</span>
        </div>

        {/* ── Authorizer Signature ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <div style={{ textAlign: "center", minWidth: "280px" }}>
            <div>ลงชื่อ ........................................... ผู้มีอำนาจสั่งใช้รถ</div>
            <div style={{ marginTop: "8px" }}>(..........................................)</div>
            <div style={{ marginTop: "4px", fontSize: "12px" }}>
              นักจัดการงานทั่วไปปฏิบัติการ
            </div>
          </div>
        </div>

        {/* ── Second Divider ── */}
        <hr style={HR} />

        {/* ── Mileage Section ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px 24px",
            marginBottom: "24px",
          }}
        >
          {[
            { label: "เลขไมล์ก่อนใช้รถ", unit: "กม.", right: false },
            { label: "ออกเวลา",           unit: "น.",  right: true  },
            { label: "เลขไมล์หลังใช้รถ", unit: "กม.", right: false },
            { label: "ถึงเวลา",           unit: "น.",  right: true  },
            { label: "รวมระยะทางที่ใช้",  unit: "กม.", right: false },
          ].map(({ label, unit }) => (
            <div key={label} style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
              <span style={{ whiteSpace: "nowrap" }}>{label}</span>
              <span style={GROW} />
              <span>{unit}</span>
            </div>
          ))}
        </div>

        {/* ── Driver Signature ── */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center", minWidth: "260px" }}>
            <div>ลงชื่อ ........................................... พนักงานขับรถยนต์</div>
          </div>
        </div>
      </div>
    );
  }
);

BookingPdfTemplate.displayName = "BookingPdfTemplate";
export default BookingPdfTemplate;
