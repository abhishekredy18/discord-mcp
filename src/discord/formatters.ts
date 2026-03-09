import {
  ChannelType,
  type Embed,
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
    ...(m.embeds.length > 0 ? { embeds: m.embeds.map(fmtEmbed) } : {}),
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

function fmtEmbed(e: Embed) {
  return {
    ...(e.title ? { title: e.title } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(e.url ? { url: e.url } : {}),
    ...(e.color !== null ? { color: e.color } : {}),
    ...(e.timestamp ? { timestamp: e.timestamp } : {}),
    ...(e.author
      ? {
          author: {
            name: e.author.name,
            ...(e.author.url ? { url: e.author.url } : {}),
          },
        }
      : {}),
    ...(e.footer ? { footer: e.footer.text } : {}),
    ...(e.image ? { image_url: e.image.url } : {}),
    ...(e.thumbnail ? { thumbnail_url: e.thumbnail.url } : {}),
    ...(e.fields?.length > 0
      ? {
          fields: e.fields.map((f) => ({
            name: f.name,
            value: f.value,
            ...(f.inline ? { inline: true } : {}),
          })),
        }
      : {}),
  };
}

export { CHANNEL_TYPE_NAMES, fmtChannel, fmtEmbed, fmtMessage, fmtThread };
