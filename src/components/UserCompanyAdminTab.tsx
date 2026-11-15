"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  KeyRound,
  Plus,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/demo-seed";
import {
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  type AuthSession,
  type Company,
  type User,
  type UserPermissions,
  type UserRole,
} from "@/lib/types";

interface UserCompanyAdminTabProps {
  session: AuthSession;
  onSwitchCompany: (companyId: number) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const PERMISSION_DEFINITIONS: {
  key: keyof UserPermissions;
  label: string;
  description: string;
}[] = [
  {
    key: "canManageTravelOrders",
    label: "Upravljanje putnim nalozima",
    description: "Kreiranje, uređivanje i brisanje tuzemnih i inozemnih naloga",
  },
  {
    key: "canApproveTravelOrders",
    label: "Odobravanje i isplata naloga",
    description: "Promjena statusa naloga u Odobren, Obračunat i Isplaćen",
  },
  {
    key: "canManageLoco",
    label: "Upravljanje loco vožnjama",
    description: "Unos i obračun gradskih / loko vožnji",
  },
  {
    key: "canManageMasterData",
    label: "Matični podaci i postavke",
    description: "Uređivanje radnika, vozila i postavki tvrtke",
  },
  {
    key: "canViewAnalytics",
    label: "Analitika i izvještaji",
    description: "Pregled analitike troškova i izvoz CSV izvještaja",
  },
  {
    key: "canManageJoppd",
    label: "JOPPD obrasci",
    description: "Priprema i preuzimanje JOPPD XML obrasca za Poreznu upravu",
  },
  {
    key: "canBackupRestore",
    label: "Sigurnosna kopija / Backup",
    description: "Izrada sigurnosne kopije i vraćanje podataka tvrtke",
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  global_admin: "Globalni Admin",
  company_admin: "Administrator tvrtke",
  user: "Korisnik (Podkorisnik)",
};

export const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  global_admin: "bg-purple-100 text-purple-800 border-purple-200",
  company_admin: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function UserCompanyAdminTab({
  session,
  onSwitchCompany,
  onRefreshData,
}: UserCompanyAdminTabProps) {
  const isGlobalAdmin = session.user.role === "global_admin";
  const [subTab, setSubTab] = useState<"USERS" | "COMPANIES">("USERS");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filter users by company (for global_admin)
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");

  // New Company Form State (for global_admin)
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompOib, setNewCompOib] = useState("");
  const [newCompAddress, setNewCompAddress] = useState("");
  const [newCompCity, setNewCompCity] = useState("10000 Zagreb");
  const [newCompIban, setNewCompIban] = useState("HR");
  const [newCompDirector, setNewCompDirector] = useState("");
  const [newCompPrefix, setNewCompPrefix] = useState("PN");
  const [savingCompany, setSavingCompany] = useState(false);

  // Editing Company State
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editCompData, setEditCompData] = useState<Partial<Company>>({});

  // New User Form State
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("lozinka123");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [newUserCompanyId, setNewUserCompanyId] = useState<number>(
    session.activeCompanyId
  );
  const [newUserPerms, setNewUserPerms] = useState<UserPermissions>({
    ...DEFAULT_USER_PERMISSIONS,
  });
  const [savingUser, setSavingUser] = useState(false);

  // Password Reset Modal / Inline State
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(
    null
  );
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  const showMessage = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        apiFetch("/api/companies"),
        apiFetch("/api/users"),
      ]);
      if (cRes.ok) {
        setCompanies(await cRes.json());
      }
      if (uRes.ok) {
        setUsers(await uRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData, session.activeCompanyId]);

  useEffect(() => {
    setNewUserCompanyId(session.activeCompanyId);
  }, [session.activeCompanyId]);

  // --- Company Actions ---
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompOib.trim()) {
      showMessage("error", "Naziv i OIB tvrtke su obavezni.");
      return;
    }
    setSavingCompany(true);
    try {
      const res = await apiFetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompName.trim(),
          oib: newCompOib.trim(),
          address: newCompAddress.trim(),
          city: newCompCity.trim(),
          iban: newCompIban.trim(),
          director_name: newCompDirector.trim(),
          order_prefix: newCompPrefix.trim() || "PN",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Greška pri kreiranju tvrtke.");
        return;
      }
      showMessage("success", `Tvrtka "${data.name}" uspješno je dodana.`);
      setNewCompName("");
      setNewCompOib("");
      setNewCompAddress("");
      setNewCompCity("10000 Zagreb");
      setNewCompIban("HR");
      setNewCompDirector("");
      setNewCompPrefix("PN");
      setShowNewCompanyForm(false);
      await fetchAdminData();
      await onRefreshData();
    } finally {
      setSavingCompany(false);
    }
  };

  const startEditCompany = (comp: Company) => {
    setEditingCompanyId(comp.id);
    setEditCompData({
      name: comp.name,
      oib: comp.oib,
      address: comp.address,
      city: comp.city,
      iban: comp.iban,
      director_name: comp.director_name,
      order_prefix: comp.order_prefix,
    });
  };

  const handleSaveCompanyEdit = async (id: number) => {
    const res = await apiFetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editCompData),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage("error", data.error || "Greška pri spremanju tvrtke.");
      return;
    }
    showMessage("success", `Podaci tvrtke "${data.name}" su ažurirani.`);
    setEditingCompanyId(null);
    await fetchAdminData();
    await onRefreshData();
  };

  const handleToggleCompanyActive = async (comp: Company) => {
    const nextActive = comp.active === 1 ? 0 : 1;
    const res = await apiFetch(`/api/companies/${comp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (res.ok) {
      showMessage(
        "success",
        `Tvrtka "${comp.name}" je sada ${
          nextActive === 1 ? "aktivna" : "deaktivirana"
        }.`
      );
      await fetchAdminData();
      await onRefreshData();
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri promjeni statusa tvrtke.");
    }
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (
      !confirm(
        `Jeste li sigurni da želite trajno obrisati tvrtku "${comp.name}" i sve njezine podatke?`
      )
    )
      return;
    const res = await apiFetch(`/api/companies/${comp.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showMessage("success", `Tvrtka "${comp.name}" je obrisana.`);
      await fetchAdminData();
      await onRefreshData();
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Nije moguće obrisati tvrtku.");
    }
  };

  // --- User Actions ---
  const applyPermissionPreset = (
    preset: "DJELATNIK" | "RACUNOVODSTVO" | "VODITELJ" | "SVE"
  ) => {
    if (preset === "SVE") {
      setNewUserPerms({ ...ALL_PERMISSIONS });
    } else if (preset === "RACUNOVODSTVO") {
      setNewUserPerms({
        canManageTravelOrders: true,
        canApproveTravelOrders: true,
        canManageLoco: true,
        canManageMasterData: true,
        canViewAnalytics: true,
        canManageJoppd: true,
        canBackupRestore: true,
      });
    } else if (preset === "VODITELJ") {
      setNewUserPerms({
        canManageTravelOrders: true,
        canApproveTravelOrders: true,
        canManageLoco: true,
        canManageMasterData: false,
        canViewAnalytics: true,
        canManageJoppd: false,
        canBackupRestore: false,
      });
    } else {
      setNewUserPerms({ ...DEFAULT_USER_PERMISSIONS });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      showMessage("error", "Ime, e-mail i lozinka su obavezni.");
      return;
    }
    setSavingUser(true);
    try {
      const targetCompanyId = isGlobalAdmin
        ? newUserRole === "global_admin"
          ? newUserCompanyId || session.activeCompanyId
          : newUserCompanyId
        : session.activeCompanyId;

      const effectivePerms =
        newUserRole === "global_admin" || newUserRole === "company_admin"
          ? ALL_PERMISSIONS
          : newUserPerms;

      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          company_id: targetCompanyId,
          permissions: effectivePerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Greška pri kreiranju korisnika.");
        return;
      }
      showMessage(
        "success",
        `Korisnik "${data.full_name}" (${data.email}) uspješno je dodan.`
      );
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("lozinka123");
      setNewUserRole("user");
      setNewUserPerms({ ...DEFAULT_USER_PERMISSIONS });
      setShowNewUserForm(false);
      await fetchAdminData();
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleUserPermission = async (
    u: User,
    permKey: keyof UserPermissions
  ) => {
    if (u.role === "global_admin" || u.role === "company_admin") return;
    const updatedPermissions: UserPermissions = {
      ...u.permissions,
      [permKey]: !u.permissions[permKey],
    };
    const res = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: updatedPermissions }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showMessage(
        "success",
        `Ovlasti za korisnika "${u.full_name}" su ažurirane.`
      );
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri ažuriranju ovlasti.");
    }
  };

  const handleChangeUserRole = async (u: User, newRole: UserRole) => {
    const res = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: newRole,
        permissions:
          newRole === "user" ? u.permissions || DEFAULT_USER_PERMISSIONS : ALL_PERMISSIONS,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showMessage(
        "success",
        `Uloga korisnika "${u.full_name}" promijenjena u ${ROLE_LABELS[newRole]}.`
      );
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri promjeni uloge.");
    }
  };

  const handleChangeUserCompany = async (u: User, companyId: number) => {
    const res = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId }),
    });
    if (res.ok) {
      await fetchAdminData();
      showMessage("success", `Tvrtka korisnika "${u.full_name}" je ažurirana.`);
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri promjeni tvrtke.");
    }
  };

  const handleToggleUserActive = async (u: User) => {
    const nextActive = u.active === 1 ? 0 : 1;
    const res = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showMessage(
        "success",
        `Korisnik "${u.full_name}" je sada ${
          nextActive === 1 ? "aktivan" : "deaktiviran"
        }.`
      );
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri promjeni statusa.");
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!resetPasswordVal.trim() || resetPasswordVal.trim().length < 4) {
      showMessage("error", "Nova lozinka mora imati barem 4 znaka.");
      return;
    }
    const res = await apiFetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPasswordVal.trim() }),
    });
    if (res.ok) {
      showMessage("success", "Lozinka korisnika uspješno je promijenjena.");
      setResetPasswordUserId(null);
      setResetPasswordVal("");
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri promjeni lozinke.");
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.id === session.user.id) {
      showMessage("error", "Ne možete obrisati vlastiti korisnički račun.");
      return;
    }
    if (
      !confirm(
        `Jeste li sigurni da želite obrisati korisnika "${u.full_name}" (${u.email})?`
      )
    )
      return;
    const res = await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      showMessage("success", `Korisnik "${u.full_name}" je obrisan.`);
    } else {
      const err = await res.json();
      showMessage("error", err.error || "Greška pri brisanju korisnika.");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!isGlobalAdmin) {
      return u.company_id === session.activeCompanyId;
    }
    if (companyFilter === "ALL") return true;
    return String(u.company_id) === companyFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Role Context */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                {isGlobalAdmin
                  ? "Globalna administracija tvrtki, korisnika i ovlasti"
                  : `Korisnici i ovlasti tvrtke — ${session.activeCompany.name}`}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  ROLE_BADGE_STYLE[session.user.role]
                }`}
              >
                <UserCheck className="w-3 h-3" />
                {ROLE_LABELS[session.user.role]}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isGlobalAdmin
                ? "Upravljajte svim tvrtkama u sustavu, kreirajte lokalne administratore i dodjeljujte granularna prava pristupa."
                : "Dodajte podkorisnike svoje tvrtke (računovodstvo, voditelji, djelatnici) i precizno odredite kojim modulima imaju pristup."}
            </p>
          </div>
        </div>

        {isGlobalAdmin && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab("USERS")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === "USERS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Korisnici i prava ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab("COMPANIES")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === "COMPANIES"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Tvrtke ({companies.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== COMPANIES SECTION (Global Admin) ==================== */}
      {isGlobalAdmin && subTab === "COMPANIES" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Registrirane tvrtke u sustavu ({companies.length})
              </h3>
              <p className="text-xs text-slate-500">
                Svaka tvrtka ima vlastite radnike, vozila, putne naloge, loko
                vožnje i postavke.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewCompanyForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {showNewCompanyForm ? "Zatvori obrazac" : "Dodaj novu tvrtku"}
              </span>
            </button>
          </div>

          {showNewCompanyForm && (
            <form
              onSubmit={handleCreateCompany}
              className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900">
                  Nova tvrtka u sustavu
                </h4>
                <button
                  type="button"
                  onClick={() => setShowNewCompanyForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Naziv tvrtke *
                  </label>
                  <input
                    type="text"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    placeholder="npr. Primorska Gradnja d.o.o."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    OIB (11 znamenki) *
                  </label>
                  <input
                    type="text"
                    value={newCompOib}
                    onChange={(e) => setNewCompOib(e.target.value)}
                    placeholder="12345678901"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    IBAN žiro računa
                  </label>
                  <input
                    type="text"
                    value={newCompIban}
                    onChange={(e) => setNewCompIban(e.target.value)}
                    placeholder="HR1223600001101234567"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ulica i kućni broj
                  </label>
                  <input
                    type="text"
                    value={newCompAddress}
                    onChange={(e) => setNewCompAddress(e.target.value)}
                    placeholder="npr. Jadranska obala 14"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Poštanski broj i grad
                  </label>
                  <input
                    type="text"
                    value={newCompCity}
                    onChange={(e) => setNewCompCity(e.target.value)}
                    placeholder="51000 Rijeka"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Odgovorna osoba
                    </label>
                    <input
                      type="text"
                      value={newCompDirector}
                      onChange={(e) => setNewCompDirector(e.target.value)}
                      placeholder="Ime direktora"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Prefiks naloga
                    </label>
                    <input
                      type="text"
                      value={newCompPrefix}
                      onChange={(e) => setNewCompPrefix(e.target.value)}
                      placeholder="PN"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyForm(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={savingCompany}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingCompany ? "Spremanje..." : "Kreiraj tvrtku"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Companies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((comp) => {
              const isCurrent = comp.id === session.activeCompanyId;
              const isEditing = editingCompanyId === comp.id;

              return (
                <div
                  key={comp.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between gap-4 transition ${
                    isCurrent
                      ? "border-blue-500 ring-1 ring-blue-500/20"
                      : "border-slate-200"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-blue-700 uppercase">
                        Uređivanje tvrtke #{comp.id}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={editCompData.name || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              name: e.target.value,
                            })
                          }
                          placeholder="Naziv tvrtke"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editCompData.oib || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              oib: e.target.value,
                            })
                          }
                          placeholder="OIB"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={editCompData.address || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              address: e.target.value,
                            })
                          }
                          placeholder="Adresa"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editCompData.city || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              city: e.target.value,
                            })
                          }
                          placeholder="Grad"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editCompData.iban || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              iban: e.target.value,
                            })
                          }
                          placeholder="IBAN"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={editCompData.director_name || ""}
                          onChange={(e) =>
                            setEditCompData({
                              ...editCompData,
                              director_name: e.target.value,
                            })
                          }
                          placeholder="Odgovorna osoba"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingCompanyId(null)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                        >
                          Odustani
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveCompanyEdit(comp.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Spremi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                                {comp.name}
                              </h4>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                                  <Check className="w-3 h-3" />
                                  Aktivna tvrtka
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  comp.active === 1
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {comp.active === 1 ? "Aktivna" : "Neaktivna"}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-slate-500 mt-0.5">
                              OIB: {comp.oib} · IBAN: {comp.iban || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-0.5">
                          <div>
                            Sjedište: <strong>{comp.address || "—"}</strong>,{" "}
                            {comp.city}
                          </div>
                          <div>
                            Odgovorna osoba:{" "}
                            <strong>{comp.director_name || "—"}</strong> ·
                            Prefiks: <span className="font-mono">{comp.order_prefix}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-center">
                            <div className="text-[10px] text-slate-500">
                              Korisnici
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {comp.user_count ??
                                users.filter((u) => u.company_id === comp.id)
                                  .length}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-center">
                            <div className="text-[10px] text-slate-500">
                              Radnici
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {comp.employee_count ?? "—"}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-center">
                            <div className="text-[10px] text-slate-500">
                              Putni nalozi
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {comp.order_count ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => onSwitchCompany(comp.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Prebaci u ovu tvrtku</span>
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-blue-700">
                            Trenutno odabrana u zaglavlju
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditCompany(comp)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Uredi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCompanyActive(comp)}
                            className="rounded-lg border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
                          >
                            {comp.active === 1 ? "Deaktiviraj" : "Aktiviraj"}
                          </button>
                          {companies.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCompany(comp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              title="Obriši tvrtku"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== USERS & PERMISSIONS SECTION ==================== */}
      {(subTab === "USERS" || !isGlobalAdmin) && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isGlobalAdmin
                    ? `Korisnički računi i ovlasti (${filteredUsers.length})`
                    : `Korisnici tvrtke ${session.activeCompany.name} (${filteredUsers.length})`}
                </h3>
                <p className="text-xs text-slate-500">
                  Kliknite na bilo koju ovlast (kućicu) za trenutno uključivanje
                  ili isključivanje pristupa modulu za pojedinog korisnika.
                </p>
              </div>

              {isGlobalAdmin && (
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                >
                  <option value="ALL">Sve tvrtke ({users.length})</option>
                  {companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowNewUserForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {showNewUserForm
                  ? "Zatvori obrazac"
                  : isGlobalAdmin
                  ? "Novi korisnik"
                  : "Dodaj podkorisnika tvrtke"}
              </span>
            </button>
          </div>

          {/* Add New User Form */}
          {showNewUserForm && (
            <form
              onSubmit={handleCreateUser}
              className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isGlobalAdmin
                      ? "Kreiranje novog korisnika u sustavu"
                      : `Novi podkorisnik za tvrtku ${session.activeCompany.name}`}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Unesite osnovne podatke za prijavu i odaberite prava
                    pristupa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewUserForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ime i prezime *
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="npr. Ana Kovačić"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    E-mail adresa (za prijavu) *
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="ana.kovacic@tvrtka.hr"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Početna lozinka *
                  </label>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Lozinka"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uloga u sustavu *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="user">
                      Korisnik / Podkorisnik (granularna prava)
                    </option>
                    <option value="company_admin">
                      Administrator tvrtke (sva prava u tvrtki)
                    </option>
                    {isGlobalAdmin && (
                      <option value="global_admin">
                        Globalni Admin (upravljanje cijelim sustavom)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {isGlobalAdmin && (
                <div className="max-w-md">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pripadajuća tvrtka
                  </label>
                  <select
                    value={newUserCompanyId}
                    onChange={(e) => setNewUserCompanyId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (OIB: {c.oib})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Granular permissions selector when role === "user" */}
              {newUserRole === "user" ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Prava pristupa modulima za podkorisnika:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">
                        Predlošci:
                      </span>
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset("DJELATNIK")}
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 cursor-pointer"
                      >
                        Djelatnik (osnovno)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset("VODITELJ")}
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 cursor-pointer"
                      >
                        Voditelj (odobravanje)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset("RACUNOVODSTVO")}
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 cursor-pointer"
                      >
                        Računovodstvo (sve)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const checked = newUserPerms[perm.key];
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition ${
                            checked
                              ? "bg-blue-50/60 border-blue-300 text-slate-900"
                              : "bg-slate-50/60 border-slate-200 text-slate-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setNewUserPerms((prev) => ({
                                ...prev,
                                [perm.key]: !prev[perm.key],
                              }))
                            }
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="font-semibold">{perm.label}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {perm.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Odabrana uloga (<strong>{ROLE_LABELS[newUserRole]}</strong>)
                    automatski ima uključene sve ovlasti.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserForm(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>
                    {savingUser ? "Kreiranje..." : "Spremi novog korisnika"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Users List */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Učitavanje korisnika i ovlasti...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Nema pronađenih korisnika.
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredUsers.map((u) => {
                const isAdminRole =
                  u.role === "global_admin" || u.role === "company_admin";
                const isSelf = u.id === session.user.id;

                return (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4"
                  >
                    {/* User Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {u.full_name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">
                              {u.full_name}
                            </span>
                            {isSelf && (
                              <span className="rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                Vi (prijavljeni)
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                ROLE_BADGE_STYLE[u.role]
                              }`}
                            >
                              {ROLE_LABELS[u.role]}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                u.active === 1
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {u.active === 1 ? "Aktivan" : "Neaktivan"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{u.email}</span>
                            {u.company_name && (
                              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {u.company_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Role, Company (if global_admin), Password Reset, Active, Delete */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Role selector */}
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            handleChangeUserRole(
                              u,
                              e.target.value as UserRole
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                          title="Promijeni ulogu"
                        >
                          <option value="user">Korisnik (Podkorisnik)</option>
                          <option value="company_admin">
                            Administrator tvrtke
                          </option>
                          {isGlobalAdmin && (
                            <option value="global_admin">Globalni Admin</option>
                          )}
                        </select>

                        {/* Company selector for global_admin */}
                        {isGlobalAdmin && (
                          <select
                            value={u.company_id || ""}
                            onChange={(e) =>
                              handleChangeUserCompany(
                                u,
                                Number(e.target.value)
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 max-w-[180px]"
                            title="Pripadajuća tvrtka"
                          >
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordUserId(
                              resetPasswordUserId === u.id ? null : u.id
                            );
                            setResetPasswordVal("");
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Lozinka</span>
                        </button>

                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              className="rounded-xl border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
                            >
                              {u.active === 1 ? "Deaktiviraj" : "Aktiviraj"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              title="Obriši korisnika"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline Password Reset */}
                    {resetPasswordUserId === u.id && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <span className="text-xs font-medium text-slate-700">
                          Nova lozinka za <strong>{u.full_name}</strong>:
                        </span>
                        <input
                          type="text"
                          value={resetPasswordVal}
                          onChange={(e) => setResetPasswordVal(e.target.value)}
                          placeholder="Unesite novu lozinku..."
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u.id)}
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Spremi lozinku
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetPasswordUserId(null)}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2"
                        >
                          Odustani
                        </button>
                      </div>
                    )}

                    {/* Granular Permissions Row */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Prava pristupa modulima (Ovlasti)
                        </span>
                        {isAdminRole && (
                          <span className="text-[11px] text-blue-600 font-medium">
                            Administratori imaju sve ovlasti automatski uključene
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                        {PERMISSION_DEFINITIONS.map((perm) => {
                          const hasPerm = isAdminRole
                            ? true
                            : Boolean(u.permissions?.[perm.key]);
                          return (
                            <button
                              key={perm.key}
                              type="button"
                              disabled={isAdminRole}
                              onClick={() =>
                                handleToggleUserPermission(u, perm.key)
                              }
                              title={perm.description}
                              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition ${
                                isAdminRole
                                  ? "bg-slate-50 border-slate-200 text-slate-600 cursor-default"
                                  : hasPerm
                                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 hover:bg-emerald-100/80 cursor-pointer"
                                  : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 cursor-pointer"
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  hasPerm
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "bg-white border-slate-300"
                                }`}
                              >
                                {hasPerm && <Check className="w-3 h-3" />}
                              </span>
                              <span className="line-clamp-2 leading-tight text-[11px]">
                                {perm.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
