import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { addItem, buyItem, listItems, removeItem } from "../../shop/service";
import { CURRENCY, jenny } from "../../constants";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription(`متجر ${CURRENCY.name}: رتب وحماية من السرقة`)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("list").setDescription("اعرض عناصر المتجر"))
    .addSubcommand((s) =>
      s
        .setName("buy")
        .setDescription("اشترِ عنصراً")
        .addStringOption((o) => o.setName("item").setDescription("العنصر").setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("additem")
        .setDescription("[إدارة] أضف عنصراً للمتجر")
        .addStringOption((o) => o.setName("id").setDescription("معرف قصير (إنجليزي، بدون مسافات)").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("اسم العنصر").setRequired(true))
        .addIntegerOption((o) => o.setName("price").setDescription("السعر").setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("نوع العنصر")
            .setRequired(true)
            .addChoices({ name: "رتبة", value: "role" }, { name: "حماية من السرقة", value: "rob_protection" }),
        )
        .addRoleOption((o) => o.setName("role").setDescription("الرتبة (لو النوع رتبة)"))
        .addIntegerOption((o) => o.setName("hours").setDescription("عدد ساعات الحماية (لو النوع حماية)").setMinValue(1)),
    )
    .addSubcommand((s) =>
      s
        .setName("removeitem")
        .setDescription("[إدارة] احذف عنصراً من المتجر")
        .addStringOption((o) => o.setName("item").setDescription("العنصر").setRequired(true).setAutocomplete(true)),
    ),

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const items = await listItems(guildId);
      if (items.length === 0) {
        await interaction.reply({ content: "🛒 المتجر فاضي حالياً.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lines = items.map((i) => {
        const detail = i.type === "role" ? `<@&${i.roleId}>` : `حماية ${i.protectionHours} ساعة`;
        return `**${i.name}** \`(${i.itemId})\`\n┗ ${jenny(i.price)} — ${detail}`;
      });
      const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle("🛒 المتجر").setDescription(lines.join("\n\n"));
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "buy") {
      const itemId = interaction.options.getString("item", true);
      const member = await getGuild(interaction).members.fetch(interaction.user.id);
      const result = await buyItem(member, guildId, itemId);

      if (!result.ok) {
        const messages: Record<string, string> = {
          not_found: "❌ ما فيه عنصر بهذا المعرف.",
          insufficient: "❌ رصيد محفظتك ما يكفي.",
          role_missing: "❌ الرتبة المرتبطة بهذا العنصر انحذفت من السيرفر، تواصل مع الإدارة.",
        };
        await interaction.reply({ content: messages[result.reason], flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({
        content: `✅ اشتريت **${result.item.name}** مقابل ${jenny(result.item.price)}!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "additem") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "⛔ هذا الأمر للإدارة فقط.", flags: MessageFlags.Ephemeral });
        return;
      }
      const id = interaction.options.getString("id", true);
      const name = interaction.options.getString("name", true);
      const price = interaction.options.getInteger("price", true);
      const type = interaction.options.getString("type", true) as "role" | "rob_protection";
      const role = interaction.options.getRole("role");
      const hours = interaction.options.getInteger("hours");

      if (type === "role" && !role) {
        await interaction.reply({ content: "❌ لازم تحدد رتبة لعنصر من نوع رتبة.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (type === "rob_protection" && !hours) {
        await interaction.reply({ content: "❌ لازم تحدد عدد الساعات لعنصر الحماية.", flags: MessageFlags.Ephemeral });
        return;
      }

      await addItem(guildId, {
        itemId: id,
        name,
        price,
        type,
        roleId: role?.id,
        protectionHours: hours ?? undefined,
      });
      await interaction.reply({ content: `✅ تمت إضافة **${name}** للمتجر.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "removeitem") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "⛔ هذا الأمر للإدارة فقط.", flags: MessageFlags.Ephemeral });
        return;
      }
      const itemId = interaction.options.getString("item", true);
      const removed = await removeItem(guildId, itemId);
      await interaction.reply({
        content: removed ? "✅ تم حذف العنصر." : "❌ ما فيه عنصر بهذا المعرف.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  },

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.respond([]);
      return;
    }
    const query = interaction.options.getFocused().toLowerCase();
    const items = await listItems(guildId);
    const results = items
      .filter((i) => i.name.toLowerCase().includes(query) || i.itemId.includes(query))
      .map((i) => ({ name: `${i.name} — ${i.price} Jenny`, value: i.itemId }))
      .slice(0, 25);
    await interaction.respond(results);
  },
};

export default command;
