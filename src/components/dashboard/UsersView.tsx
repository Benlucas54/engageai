"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ADMIN_USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

export function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await getSupabase().auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token}`,
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users", { headers });
      if (res.status === 403) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setIsAdmin(true);
        setUsers(data.users);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password, display_name: displayName || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setEmail("");
        setPassword("");
        setDisplayName("");
        fetchUsers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchUsers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="text-[13px] text-content-faint">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="text-[13px] text-content-faint">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-4 py-3">
          {error}
        </div>
      )}

      {/* Create user form */}
      <div className="bg-surface border border-border rounded-[9px] p-5">
        <h2 className="text-[14px] font-medium text-content mb-4">Add user</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-3 py-[7px] rounded-[7px] border border-border bg-surface text-[13px] text-content placeholder:text-content-xfaint outline-none focus:border-content-faint transition-colors"
            />
            <input
              type="text"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="px-3 py-[7px] rounded-[7px] border border-border bg-surface text-[13px] text-content placeholder:text-content-xfaint outline-none focus:border-content-faint transition-colors"
            />
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="px-3 py-[7px] rounded-[7px] border border-border bg-surface text-[13px] text-content placeholder:text-content-xfaint outline-none focus:border-content-faint transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-[7px] rounded-[7px] bg-content text-white text-[13px] font-medium cursor-pointer disabled:opacity-50 border-none"
          >
            {creating ? "Creating..." : "Create user"}
          </button>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-surface border border-border rounded-[9px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-content-faint">
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium">Last sign in</th>
              <th className="px-5 py-3 font-medium w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border-light last:border-b-0">
                <td className="px-5 py-3 text-content">
                  {user.email}
                  {user.id === ADMIN_USER_ID && (
                    <span className="ml-2 text-[10px] px-[6px] py-[1px] rounded-full bg-content text-white font-medium">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-content-faint">
                  {user.display_name || "\u2014"}
                </td>
                <td className="px-5 py-3 text-content-faint">
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3 text-content-faint">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Never"}
                </td>
                <td className="px-5 py-3 text-right">
                  {user.id !== ADMIN_USER_ID && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id}
                      className="text-[12px] text-content-faint hover:text-red-600 cursor-pointer bg-transparent border-none transition-colors disabled:opacity-50"
                    >
                      {deletingId === user.id ? "..." : "Remove"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-content-faint">
                  No users yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
