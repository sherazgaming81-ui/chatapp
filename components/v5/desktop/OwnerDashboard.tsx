'use client';

/**
 * OwnerDashboard — sirf owner ke liye (rail ke crown icon se).
 * - Stats cards: total messages, active members, messages today, top senders
 * - Moderation: muted users (live remaining time + unmute), banned (unban), warnings
 * - Quick commands: /lock /unlock /announce /clear (inputs ke saath)
 * - Per-member slow mode setter
 * - Owner poll creator
 */

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import {
  Icon, ICONS, SectionTitle, backendV5, v5call, runOwnerCommand,
  fmtCountdown, RoleBadge, type MutedUserInfo, type BannedUserInfo, type WarnInfo, type GroupStats, type CommandResult,
} from './common';

interface Props {
  chat: Chat;
  me: UserProfile;
  ownerId: string | null;
  /** v6: group kholo (dashboard se naye group me jao) — Chat ya chat ID */
  onOpenGroup?: (chat: Chat | string) => void;
}

function StatCard({ icon, label, value, tint }: { icon: string; label: string; value: string | number; tint: string }) {
  return (
    <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 flex items-center gap-3.5">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
        <Icon d={icon} size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-[22px] font-semibold text-[#e9edef] leading-none tabular-nums">{value}</span>
        <span className="block text-[12px] text-[#8696a0] mt-1.5 truncate">{label}</span>
      </span>
    </div>
  );
}

export default function OwnerDashboard({ chat, me, ownerId, onOpenGroup }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteStats, setRemoteStats] = useState<GroupStats | null>(null);
  const [muted, setMuted] = useState<MutedUserInfo[]>([]);
  const [banned, setBanned] = useState<BannedUserInfo[]>([]);
  const [warnings, setWarnings] = useState<WarnInfo[]>([]);
  const [announce, setAnnounce] = useState('');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [slowUser, setSlowUser] = useState('');
  const [slowSecs, setSlowSecs] = useState('30');
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [, tick] = useState(0);
  const [dmUser, setDmUser] = useState(''); // v6.3: direct chat target
  // ---- v6: groups (naya group + members) ----
  const [groups, setGroups] = useState<Chat[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<UserProfile[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // v6: groups list (live) — naya group bante hi yahan nazar aayega
  useEffect(() => {
    const unsub = backend.onChats((list) => {
      setGroups(list.filter((c) => c.type === 'group'));
    });
    return unsub;
  }, []);

  const createNewGroup = async () => {
    const nm = newGroupName.trim();
    if (!nm) { showToast('Group ka naam likhein'); return; }
    setCreating(true);
    try {
      await backend.createGroup(nm, []);
      setNewGroupName('');
      showToast(`"${nm}" ban gaya ✓ — neeche list me kholein`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Group nahi ban saka');
    } finally { setCreating(false); }
  };

  // v6.3: member se direct chat shuru karo
  const startDM = async () => {
    if (!dmUser) { showToast('Pehle member chunein'); return; }
    if (!backend.createDM) { showToast('Backend me DM nahi hai'); return; }
    setBusy(true);
    try {
      const dmId = await backend.createDM(dmUser);
      showToast('Chat tayyar ✓');
      if (onOpenGroup) onOpenGroup(dmId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Chat nahi ban saki');
    } finally { setBusy(false); }
  };

  const searchMembers = async (q: string) => {
    setMemberQuery(q);
    if (q.trim().length < 2) { setMemberResults([]); return; }
    try {
      const res = await backend.searchUsers(q.trim());
      const g = groups.find((x) => x.id === expandedGroup);
      const existing = new Set(g?.participants || []);
      setMemberResults(res.filter((u) => !existing.has(u.id)).slice(0, 8));
    } catch { setMemberResults([]); }
  };

  const addMember = async (g: Chat, u: UserProfile) => {
    if (!backend.addGroupMembers) { showToast('Backend me add members nahi hai'); return; }
    setAddingId(u.id);
    try {
      await backend.addGroupMembers(g.id, [u.id]);
      setMemberResults((l) => l.filter((x) => x.id !== u.id));
      showToast(`${u.displayName} group me add ho gaya ✓`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Add nahi ho saka');
    } finally { setAddingId(null); }
  };

  useEffect(() => {
    const unsub = backend.onMessages(chat.id, setMessages);
    // backend /stats (mile to wahi, warna local compute)
    runOwnerCommand(chat.id, '/stats')
      .then((r: CommandResult) => { if (r.stats) setRemoteStats(r.stats); })
      .catch(() => {});
    v5call(() => backendV5.getGroupStats!(chat.id)).then((s) => { if (s) setRemoteStats(s); });
    v5call(() => backendV5.getMutedUsers!(chat.id)).then((l) => { if (l) setMuted(l); });
    v5call(() => backendV5.getBannedUsers!(chat.id)).then((l) => { if (l) setBanned(l); });
    v5call(() => backendV5.getWarnings!(chat.id)).then((l) => { if (l) setWarnings(l); });
    return unsub;
  }, [chat.id]);

  // muted countdown ticker
  useEffect(() => {
    if (!muted.length) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [muted.length]);

  const stats = useMemo<GroupStats>(() => {
    if (remoteStats) return remoteStats;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const per = new Map<string, { displayName: string; count: number }>();
    let today = 0;
    for (const m of messages) {
      if (m.createdAt >= startOfDay.getTime()) today++;
      const e = per.get(m.senderId) || { displayName: m.senderName || 'Koi', count: 0 };
      e.count++;
      per.set(m.senderId, e);
    }
    const topSenders = [...per.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return {
      totalMessages: messages.length,
      activeMembers: new Set(messages.filter((m) => Date.now() - m.createdAt < 7 * 86400000).map((m) => m.senderId)).size,
      messagesToday: today,
      topSenders,
    };
  }, [messages, remoteStats]);

  const members = useMemo(
    () =>
      Object.entries(chat.participantProfiles || {})
        .map(([id, p]) => ({ id, name: id === me.id ? `${p.displayName || me.displayName} (aap)` : p.displayName || 'Koi' }))
        .filter((x) => x.id !== ownerId),
    [chat.participantProfiles, me, ownerId],
  );

  const run = async (cmd: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await runOwnerCommand(chat.id, cmd);
      showToast(res.text || 'Ho gaya ✓');
      if (cmd === '/lock') setLocked(true);
      if (cmd === '/unlock') setLocked(false);
      if (res.stats) setRemoteStats(res.stats);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nahi ho saka');
    } finally {
      setBusy(false);
    }
  };

  const unmute = async (u: MutedUserInfo) => {
    setBusy(true);
    try {
      if (backendV5.unmuteUser) {
        await v5call(() => backendV5.unmuteUser!(chat.id, u.userId));
        showToast(`${u.displayName} ka mute hat gaya`);
      } else {
        const res = await runOwnerCommand(chat.id, `/unmute @${u.displayName}`);
        showToast(res.text || `${u.displayName} ka mute hat gaya`);
      }
      setMuted((l) => l.filter((x) => x.userId !== u.userId));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unmute nahi ho saka');
    } finally { setBusy(false); }
  };

  const unban = async (u: BannedUserInfo) => {
    if (!confirm(`${u.displayName} ka ban hatayein?`)) return;
    setBusy(true);
    try {
      if (backendV5.unbanUser) {
        await v5call(() => backendV5.unbanUser!(chat.id, u.userId));
      } else {
        // backend me /unban command nahi hai — koshish par imandari se error
        await runOwnerCommand(chat.id, `/unban @${u.displayName}`);
      }
      setBanned((l) => l.filter((x) => x.userId !== u.userId));
      showToast(`${u.displayName} ka ban hat gaya`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unban nahi ho saka');
    } finally { setBusy(false); }
  };

  const clearWarn = async (w: WarnInfo) => {
    try {
      if (backendV5.clearWarning) await v5call(() => backendV5.clearWarning!(chat.id, w.id));
      setWarnings((l) => l.filter((x) => x.id !== w.id));
    } catch {}
  };

  const setSlow = async () => {
    const secs = parseInt(slowSecs, 10);
    if (!slowUser || isNaN(secs) || secs < 0) { showToast('Member aur seconds sahi likhein'); return; }
    setBusy(true);
    try {
      if (backendV5.setMemberSlowMode) {
        await v5call(() => backendV5.setMemberSlowMode!(chat.id, slowUser, secs));
        showToast(secs === 0 ? 'Slow mode hat gaya' : `Slow mode: ${secs} sec`);
      } else {
        // backend me per-member slow mode nahi — imandari se backend ka jawab
        const mb = members.find((m) => m.id === slowUser);
        const res = await runOwnerCommand(chat.id, `/slowmode @${mb?.name.replace(' (aap)', '')} ${secs}`);
        showToast(res.text);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Slow mode nahi laga');
    } finally { setBusy(false); }
  };

  const createPoll = async () => {
    const q = pollQ.trim();
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) { showToast('Sawal aur kam az kam 2 options likhein'); return; }
    setBusy(true);
    try {
      await backend.createPoll(chat.id, q, opts);
      setPollQ(''); setPollOpts(['', '']);
      showToast('Poll group me bhej di gayi');
    } catch { showToast('Poll nahi ban saki'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex-1 min-w-0 bg-[#0b141a] overflow-y-auto v4scroll">
      <div className="max-w-[980px] mx-auto px-6 lg:px-10 py-6">
        {/* header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-2xl bg-[#ffd447]/15 text-[#ffd447] flex items-center justify-center">
            <Icon d={ICONS.crown} size={24} />
          </span>
          <div>
            <h1 className="text-[20px] font-semibold text-[#e9edef] flex items-center gap-2">
              Owner Dashboard <RoleBadge role="owner" />
            </h1>
            <p className="text-[13px] text-[#8696a0]">Madrasa Group ka poora control</p>
          </div>
        </div>

        {/* v6: groups — naya group banao, list dekho, members add karo (sirf owner) */}
        <SectionTitle>Groups</SectionTitle>
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createNewGroup(); }}
              placeholder="Naye group ka naam likhein…"
              maxLength={60}
              className="flex-1 bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[13.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
            />
            <button
              onClick={createNewGroup}
              disabled={creating || !newGroupName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium transition disabled:opacity-50"
            >
              <Icon d={ICONS.plus} size={17} /> {creating ? 'Ban raha hai…' : 'Naya Group'}
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="text-[12.5px] text-[#8696a0] py-2">Koi group nahi mila — upar se naya banayein.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const expanded = expandedGroup === g.id;
                const memberList = Object.entries(g.participantProfiles || {}).map(([id, p]) => ({
                  id,
                  name: p.displayName || 'Koi',
                  photoURL: p.photoURL,
                  isMe: id === me.id,
                }));
                return (
                  <div key={g.id} className="bg-[#1f2c34]/50 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={g.name} photoURL={g.photoURL} size={38} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-[#e9edef] truncate flex items-center gap-2">
                          {g.name}
                          {g.isMainGroup && (
                            <span className="text-[10px] font-semibold bg-[#00a884]/15 text-[#00a884] rounded-full px-2 py-[1px]">Main</span>
                          )}
                        </p>
                        <p className="text-[11.5px] text-[#8696a0]">{g.participants.length} members</p>
                      </div>
                      {onOpenGroup && (
                        <button
                          onClick={() => onOpenGroup(g)}
                          className="text-[12px] font-medium text-[#00a884] hover:underline px-1"
                        >
                          Kholo
                        </button>
                      )}
                      <button
                        onClick={() => { setExpandedGroup(expanded ? null : g.id); setMemberQuery(''); setMemberResults([]); }}
                        className="text-[12px] font-medium text-[#8696a0] hover:text-[#e9edef] px-1"
                      >
                        {expanded ? 'Band karo' : 'Members'}
                      </button>
                    </div>
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#222d34]/60">
                        <div className="flex flex-wrap gap-1.5 py-2">
                          {memberList.map((m) => (
                            <span key={m.id} className="flex items-center gap-1.5 bg-[#0b141a] rounded-full pl-1 pr-2.5 py-1">
                              <Avatar name={m.name} photoURL={m.photoURL} size={22} />
                              <span className="text-[11.5px] text-[#d1d7db] max-w-[120px] truncate">{m.name}{m.isMe ? ' (aap)' : ''}</span>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <input
                            value={memberQuery}
                            onChange={(e) => searchMembers(e.target.value)}
                            placeholder="Naam likh kar member dhoondein…"
                            className="flex-1 bg-[#0b141a] rounded-xl px-3 py-2 text-[12.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
                          />
                        </div>
                        {memberResults.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {memberResults.map((u) => (
                              <div key={u.id} className="flex items-center gap-2.5 bg-[#0b141a] rounded-xl px-3 py-2">
                                <Avatar name={u.displayName} photoURL={u.photoURL} size={28} />
                                <p className="flex-1 text-[12.5px] text-[#e9edef] truncate">{u.displayName}</p>
                                <button
                                  onClick={() => addMember(g, u)}
                                  disabled={addingId === u.id}
                                  className="flex items-center gap-1 text-[12px] font-medium text-[#00a884] hover:underline disabled:opacity-50"
                                >
                                  <Icon d={ICONS.userPlus} size={14} /> {addingId === u.id ? 'Add…' : 'Add'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* v6.3: Direct Chat — kisi member se 1-to-1 baat (sirf owner) */}
        <SectionTitle>Direct Chat (sirf owner)</SectionTitle>
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 space-y-3 mb-8">
          <div className="flex gap-2">
            <select
              value={dmUser}
              onChange={(e) => setDmUser(e.target.value)}
              className="flex-1 bg-[#1f2c34] text-[#e9edef] text-[13.5px] rounded-xl px-3 py-2.5 outline-none"
            >
              <option value="">Member chunein…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              onClick={startDM}
              disabled={busy || !dmUser}
              className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium transition disabled:opacity-50"
            >
              Chat Shuru
            </button>
          </div>
          <p className="text-[12px] text-[#8696a0]">Sirf aap members se personal chat kar sakte hain.</p>
        </div>

        {/* stats */}
        <SectionTitle>Stats</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2 -mx-0 px-0">
          <StatCard icon={ICONS.chat} label="Total messages" value={stats.totalMessages} tint="bg-[#00a884]/15 text-[#00a884]" />
          <StatCard icon={ICONS.groups} label="Active members (7 din)" value={stats.activeMembers} tint="bg-[#53bdeb]/15 text-[#53bdeb]" />
          <StatCard icon={ICONS.zap} label="Aaj ke messages" value={stats.messagesToday} tint="bg-[#ff9f1c]/15 text-[#ff9f1c]" />
          <StatCard icon={ICONS.chart} label="Top sender" value={stats.topSenders[0]?.displayName?.split(' ')[0] ?? '—'} tint="bg-[#7f66ff]/15 text-[#ab9df2]" />
        </div>

        {stats.topSenders.length > 0 && (
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 mt-3">
            <p className="text-[13px] font-medium text-[#8696a0] mb-3">Top senders</p>
            <div className="space-y-2.5">
              {stats.topSenders.map((s, i) => {
                const max = stats.topSenders[0].count || 1;
                return (
                  <div key={s.userId} className="flex items-center gap-3">
                    <span className="text-[12px] text-[#8696a0] w-5 tabular-nums">{i + 1}.</span>
                    <Avatar name={s.displayName} size={30} />
                    <span className="text-[13.5px] text-[#e9edef] w-36 truncate">{s.displayName}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#1f2c34] overflow-hidden">
                      <div className="h-full bg-[#00a884] rounded-full" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} />
                    </div>
                    <span className="text-[12.5px] text-[#8696a0] tabular-nums w-12 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* quick commands */}
        <SectionTitle>Quick Commands</SectionTitle>
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(locked ? '/unlock' : '/lock')}
              disabled={busy}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-medium transition disabled:opacity-50 ${locked ? 'bg-[#00a884] text-white hover:bg-[#06cf9c]' : 'bg-[#2a3942] text-[#e9edef] hover:bg-[#374045]'}`}
            >
              <Icon d={ICONS.lock} size={17} /> {locked ? 'Unlock karo' : 'Lock karo'}
            </button>
            <button onClick={() => run('/clear', 'Saare messages delete ho jayenge. Pakka?')} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-medium bg-[#ea0038]/10 text-[#ea0038] hover:bg-[#ea0038]/20 transition disabled:opacity-50">
              <Icon d={ICONS.trash} size={17} /> Clear chat
            </button>
            <button onClick={() => run('/stats')} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-medium bg-[#2a3942] text-[#e9edef] hover:bg-[#374045] transition disabled:opacity-50">
              <Icon d={ICONS.chart} size={17} /> Stats refresh
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={announce}
              onChange={(e) => setAnnounce(e.target.value)}
              placeholder="Announcement likhein… ( /announce )"
              className="flex-1 bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[13.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
            />
            <button
              onClick={() => { if (announce.trim()) { run(`/announce ${announce.trim()}`); setAnnounce(''); } }}
              disabled={busy || !announce.trim()}
              className="px-5 rounded-xl bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium transition disabled:opacity-50"
            >
              Bhejo
            </button>
          </div>
          {locked && <p className="text-[12.5px] text-[#ffd447] flex items-center gap-1.5"><Icon d={ICONS.lock} size={14} /> Group locked hai — sirf aap message bhej sakte hain.</p>}
        </div>

        {/* moderation */}
        <SectionTitle>Moderation</SectionTitle>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4">
            <p className="text-[13.5px] font-medium text-[#e9edef] mb-1 flex items-center gap-2">
              <Icon d={ICONS.mute} size={17} className="text-[#ffd447]" /> Muted · {muted.length}
            </p>
            {typeof backendV5.getMutedUsers !== 'function' && (
              <p className="text-[11.5px] text-[#8696a0] mb-1">List backend me nahi — /mute, /unmute commands se manage karein.</p>
            )}
            {muted.length === 0 ? (
              <p className="text-[12.5px] text-[#8696a0] py-3">Koi muted nahi hai.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {muted.map((u) => (
                  <div key={u.userId} className="flex items-center gap-2.5 bg-[#1f2c34]/60 rounded-xl px-3 py-2">
                    <Avatar name={u.displayName} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#e9edef] truncate">{u.displayName}</p>
                      <p className="text-[11.5px] text-[#ffd447] tabular-nums">{fmtCountdown(u.until)} baqi</p>
                    </div>
                    <button onClick={() => unmute(u)} disabled={busy} className="text-[12px] font-medium text-[#00a884] hover:underline disabled:opacity-50">
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4">
            <p className="text-[13.5px] font-medium text-[#e9edef] mb-1 flex items-center gap-2">
              <Icon d={ICONS.x} size={17} className="text-[#ea0038]" /> Banned · {banned.length}
            </p>
            {typeof backendV5.getBannedUsers !== 'function' && (
              <p className="text-[11.5px] text-[#8696a0] mb-1">List backend me nahi — /ban command se manage karein.</p>
            )}
            {banned.length === 0 ? (
              <p className="text-[12.5px] text-[#8696a0] py-3">Koi banned nahi hai.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {banned.map((u) => (
                  <div key={u.userId} className="flex items-center gap-2.5 bg-[#1f2c34]/60 rounded-xl px-3 py-2">
                    <Avatar name={u.displayName} size={30} />
                    <p className="flex-1 text-[13px] text-[#e9edef] truncate">{u.displayName}</p>
                    <button onClick={() => unban(u)} disabled={busy} className="text-[12px] font-medium text-[#00a884] hover:underline disabled:opacity-50">
                      Unban
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4">
            <p className="text-[13.5px] font-medium text-[#e9edef] mb-1 flex items-center gap-2">
              <Icon d={ICONS.info} size={17} className="text-[#ff9f1c]" /> Warnings · {warnings.length}
            </p>
            {typeof backendV5.getWarnings !== 'function' && (
              <p className="text-[11.5px] text-[#8696a0] mb-1">List backend me nahi — /warn command se dein.</p>
            )}
            {warnings.length === 0 ? (
              <p className="text-[12.5px] text-[#8696a0] py-3">Koi warning nahi hai.</p>
            ) : (
              <div className="space-y-2 mt-2 max-h-[220px] overflow-y-auto v4scroll">
                {warnings.map((w) => (
                  <div key={w.id} className="bg-[#1f2c34]/60 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] text-[#e9edef] truncate">{w.displayName}</p>
                      <button onClick={() => clearWarn(w)} className="text-[11.5px] text-[#8696a0] hover:text-[#00a884]">Hatayein</button>
                    </div>
                    <p className="text-[12px] text-[#8696a0] truncate">{w.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* slow mode */}
        <SectionTitle>Slow Mode (per-member)</SectionTitle>
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 flex flex-wrap items-center gap-2">
          <select
            value={slowUser}
            onChange={(e) => setSlowUser(e.target.value)}
            className="bg-[#1f2c34] text-[#e9edef] text-[13.5px] rounded-xl px-3 py-2.5 outline-none min-w-[180px]"
          >
            <option value="">Member chunein…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            value={slowSecs}
            onChange={(e) => setSlowSecs(e.target.value.replace(/\D/g, ''))}
            placeholder="Seconds"
            inputMode="numeric"
            className="w-28 bg-[#1f2c34] text-[#e9edef] text-[13.5px] rounded-xl px-3 py-2.5 outline-none"
          />
          <span className="text-[12.5px] text-[#8696a0]">sec (0 = off)</span>
          <button onClick={setSlow} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium transition disabled:opacity-50">
            Lagao
          </button>
        </div>

        {/* owner poll */}
        <SectionTitle>Poll Banayein (sirf owner)</SectionTitle>
        <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 space-y-2.5 mb-8">
          <input
            value={pollQ}
            onChange={(e) => setPollQ(e.target.value)}
            placeholder="Sawal likhein…"
            className="w-full bg-[#1f2c34] rounded-xl px-4 py-3 text-[14px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
          />
          {pollOpts.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setPollOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              className="w-full bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[13.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          ))}
          <div className="flex gap-2">
            {pollOpts.length < 6 && (
              <button onClick={() => setPollOpts((a) => [...a, ''])} className="text-[13px] text-[#00a884] hover:underline px-1">
                + Option
              </button>
            )}
            <div className="flex-1" />
            <button onClick={createPoll} disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium transition disabled:opacity-50">
              Group me bhejo
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-[#1f2c34] border border-[#2a3942] text-[#e9edef] text-[13.5px] rounded-full px-5 py-2.5 shadow-2xl animate-[v4pop_.18s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
}
