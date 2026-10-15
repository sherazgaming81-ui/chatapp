"use client";
import type { ComponentType } from "react";
import { useStore } from "@/data/store";
import { Page } from "./ui";
import { ProfileCard, MyProfile, EditProfile, ProfileStudio } from "./profile/Profile";
import { GroupInfo, MembersPage, AddMembersPage, SiteLinkPage, MediaGallery, InsightsPage, RulesPage, GroupEdit, CallPage } from "./group/Group";
import * as S from "./settings/SettingsPages";
import { Tasbeeh, Duas, Qibla, Zakat, Masjids, Hajj, MoonPage, DhikrReminders } from "./deen/Tools";
import { QuranList, QuranReader } from "./deen/Quran";
import { QuizPage, TttPage, PaheliPage } from "./extras/Games";
import { StickerMaker, StickerPacks, RoomsPage, RoomPage, FilesPage, GlobalSearch } from "./extras/Extras";
import { TourPage, ExplainerPage, GesturePage } from "./onboarding/Onboarding";

function ProfileView({ id }: { id: string }) {
  const m = useStore((s) => s.members.find((x) => x.id === id));
  return <Page title={m?.name ?? "Profile"}>{m && <ProfileCard m={m} />}</Page>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PAGES: Record<string, ComponentType<any>> = {
  group: GroupInfo, members: MembersPage, addmembers: AddMembersPage, sitelink: SiteLinkPage, media: MediaGallery, insights: InsightsPage, rules: RulesPage, groupedit: GroupEdit, call: CallPage,
  starred: S.StarredPage, scheduled: S.ScheduledPage, chatlist: S.ChatListPage, pins: S.PinsPage, nickname: S.NicknamePage, tones: S.TonesPage, wallpaper: S.WallpaperPage, chattheme: S.ChatThemePage,
  disappearing: S.DisappearingPage, mute: S.MutePage, nightmode: S.NightModePage, privacy: S.PrivacyPage, blocked: S.BlockedPage, applock: S.AppLockPage, dnd: S.DndPage, storage: S.StoragePage,
  datausage: S.DataUsagePage, quality: S.QualityPage, autodl: S.AutoDlPage, backup: S.BackupPage, devices: S.DevicesPage, sync: S.SyncPage, achievements: S.AchievementsPage, help: S.HelpPage, demo: S.DemoPage,
  myprofile: MyProfile, editprofile: EditProfile, studio: ProfileStudio, "profile-view": ProfileView,
  quran: QuranList, reader: QuranReader, dua: Duas, tasbeeh: Tasbeeh, qibla: Qibla, zakat: Zakat, masjids: Masjids, hajj: Hajj, moon: MoonPage, dhikr: DhikrReminders,
  quiz: QuizPage, ttt: TttPage, paheli: PaheliPage, stickermaker: StickerMaker, stickerpacks: StickerPacks, rooms: RoomsPage, room: RoomPage, files: FilesPage, search: GlobalSearch,
  tour: TourPage, explainer: ExplainerPage, gesture: GesturePage,
};
