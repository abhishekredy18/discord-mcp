import {
  ChannelType,
  type GuildBasedChannel,
  type Message,
  type ThreadChannel,
} from "discord.js";

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
  [ChannelType.GuildAnnouncement]: "announcement",
  [ChannelType.GuildStageVoice]: "stage",
  [ChannelType.GuildForum]: "forum",
  [ChannelType.GuildMedia]: "media",
  [ChannelType.PublicThread]: "thread",
  [ChannelType.PrivateThread]: "private-thread",
  [ChannelType.AnnouncementThread]: "announcement-thread",
};

function fmtChannel(ch: GuildBasedChannel) {
  return {
    id: ch.id,
    name: ch.name,
    type: CHANNEL_TYPE_NAMES[ch.type] ?? `unknown(${ch.type})`,
    ...("topic" in ch && (ch as any).topic ? { topic: (ch as any).topic } : {}),
    ...(ch.parent ? { parent: ch.parent.name } : {}),
  };
}

function fmtMessage(m: Message) {
  return {
    id: m.id,
    author:
      m.member?.displayName ?? m.author.displayName ?? m.author.username,
    author_id: m.author.id,
    content: m.content,
    timestamp: m.createdAt.toISOString(),
    ...(m.attachments.size > 0
      ? {
          attachments: [...m.attachments.values()].map((a) => ({
            name: a.name,
            url: a.url,
            size: a.size,
            type: a.contentType,
          })),
        }
      : {}),
    ...(m.embeds.length > 0 ? { embeds: m.embeds.length } : {}),
  };
}

function fmtThread(t: ThreadChannel) {
  return {
    id: t.id,
    name: t.name,
    type: CHANNEL_TYPE_NAMES[t.type] ?? `unknown(${t.type})`,
    parent_id: t.parentId,
    parent: t.parent?.name,
    archived: t.archived ?? false,
    locked: t.locked ?? false,
    auto_archive_duration: t.autoArchiveDuration,
    member_count: t.memberCount,
    message_count: t.messageCount,
    created_at: t.createdAt?.toISOString(),
    ...(t.archived ? { archive_timestamp: t.archivedAt?.toISOString() } : {}),
    ...(t.appliedTags?.length ? { applied_tags: t.appliedTags } : {}),
  };
}

export { CHANNEL_TYPE_NAMES, fmtChannel, fmtMessage, fmtThread };
