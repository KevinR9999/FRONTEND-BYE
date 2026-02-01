import type { PublicProfile } from "../../types/social";

type Props = {
  user: PublicProfile;
  right?: React.ReactNode;
  onClick?: () => void;
};

export default function UserCard({ user, right, onClick }: Props) {
  const initials = (user.full_name?.trim()?.[0] || "U").toUpperCase();

  return (
    <div
      className={`flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm border border-slate-100 ${
        onClick ? "cursor-pointer hover:bg-slate-50" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="avatar"
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-semibold">
            {initials}
          </div>
        )}

        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">
            {user.full_name || "Usuario"}
          </div>
          <div className="text-sm text-slate-500 truncate">
            Nivel {user.level || "—"}
          </div>
        </div>
      </div>

      <div className="ml-3 shrink-0">{right}</div>
    </div>
  );
}
