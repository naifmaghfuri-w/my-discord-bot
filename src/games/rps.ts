import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type Message } from "discord.js";
import { jenny, REWARDS } from "../constants";
import { reward } from "../services/economy";

/** !حجرة → حجر ورقة مقص ضد البوت */
export const RPS_TRIGGER = /^!\s*حجر[ةه]$/;

type Choice = "rock" | "paper" | "scissors";

const CHOICES: { id: Choice; label: string; emoji: string }[] = [
  { id: "rock", label: "حجر", emoji: "🪨" },
  { id: "paper", label: "ورقة", emoji: "📄" },
  { id: "scissors", label: "مقص", emoji: "✂️" },
];
const BEATS: Record<Choice, Choice> = { rock: "scissors", paper: "rock", scissors: "paper" };
const show = (id: Choice) => {
  const c = CHOICES.find((x) => x.id === id)!;
  return `${c.emoji} ${c.label}`;
};

const cooldown = new Map<string, number>();

export async function startRps(message: Message<true>): Promise<void> {
  const last = cooldown.get(message.author.id) ?? 0;
  if (Date.now() - last < 5000) return;
  cooldown.set(message.author.id, Date.now());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    CHOICES.map((c) => new ButtonBuilder().setCustomId(`rps_${c.id}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Primary)),
  );
  const sent = await message
    .reply({ content: "اختر حركتك خلال 30 ثانية 👇", components: [row], allowedMentions: { repliedUser: false } })
    .catch(() => null);
  if (!sent) return;

  try {
    const click = await sent.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id,
      time: 30_000,
    });
    const player = click.customId.replace("rps_", "") as Choice;
    const bot = CHOICES[Math.floor(Math.random() * CHOICES.length)].id;

    let outcome: string;
    if (player === bot) outcome = "🤝 تعادل!";
    else if (BEATS[player] === bot) {
      await reward(message.author.id, message.guildId, REWARDS.rpsWin, true);
      outcome = `🎉 فزت! (+${jenny(REWARDS.rpsWin)})`;
    } else outcome = "😅 فاز البوت!";

    await click.update({ content: `أنت: **${show(player)}**\nالبوت: **${show(bot)}**\n\n${outcome}`, components: [] });
  } catch {
    await sent.edit({ content: "⌛ انتهى الوقت.", components: [] }).catch(() => undefined);
  }
}
