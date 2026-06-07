import MGMEChatJournal from "../utils/mgme-chat-journal";
import MGMECommon from "../utils/mgme-common";

const {DialogV2} = foundry.applications.api;
const {renderTemplate} = foundry.applications.handlebars;

export default class MGMEChatExtras {

  static async mgmeExportChatToJournal() {
    const defaultJournalName = `${game.i18n.localize('MGME.MythicAdventureLog')}`;
    const exportDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-exportchat-dialog.hbs', {defaultJournalName: defaultJournalName});
    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.ExportAllToJournal')},
      content: exportDialog,
        render: (event, dialog) => {
          const root = dialog.element;
          const lastConfig = game.user.getFlag('mythic-gme-tools', 'mgmeLastExportConfig');
          if (lastConfig) {
            root.querySelector("#mgme_export_highlight_flavor").checked = lastConfig.highlightFlavor;
            root.querySelector("#mgme_export_actor_img").checked = lastConfig.actorImg;
            root.querySelector("#mgme_export_include_meta").checked = lastConfig.includeMeta;
            root.querySelector("#mgme_export_clear_chat").checked = lastConfig.clearChat;
          }
          root.querySelector("#mgme_export_journal_name")?.focus()
        },
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-comments',
          label: game.i18n.localize('MGME.Export'),
          callback: (event, button) => {
            const form = button.form;
            const journalName = form.querySelector("#mgme_export_journal_name").value?.trim();
            const includeTimestamp = form.querySelector("#mgme_export_include_meta").checked;
            const includeActorImg = form.querySelector("#mgme_export_actor_img").checked;
            const highlightFlavor = form.querySelector("#mgme_export_highlight_flavor").checked;
            const clearChat = form.querySelector("#mgme_export_clear_chat").checked;
            let entries = [];
            ui.chat.collection.contents.forEach(chat => {
              entries.push(MGMEChatJournal._mgmeBuildLogChatHtml(chat, includeTimestamp, includeActorImg, highlightFlavor));
            });
            MGMEChatJournal._mgmeFindOrCreateJournal(journalName).then(targetJournal => {
              const lastPage = targetJournal.pages.contents[targetJournal.pages.contents.length-1];
              lastPage.update({text: {content: entries.join('\n')}}).then(() => {
                if (clearChat)
                  game.messages.flush();
                game.user.setFlag('mythic-gme-tools', 'mgmeLastExportConfig', {
                  'highlightFlavor': highlightFlavor,
                  'actorImg': includeActorImg,
                  'includeMeta': includeTimestamp,
                  'clearChat': clearChat
                });
              })
            })
          },
          default: true
        }
      ]
    });
  }

  static async mgmeRenderNPCsList() {
    MGMEChatJournal._mgmeFindOrCreateRolltable('NPCs List', 'Mythic Lists').then(table => {
      table.sheet.render({force: true});
    });
  }

  static async mgmeRenderThreadsList() {
    MGMEChatJournal._mgmeFindOrCreateRolltable('Threads List', 'Mythic Lists').then(table => {
      table.sheet.render({force: true});
    });
  }

  static async mgmeRollNPCsList() {
    MGMEChatJournal._mgmeFindOrCreateRolltable('NPCs List', 'Mythic Lists').then(table => {
      table.normalize().then((t) => t.draw({messageMode: MGMECommon._mgmeGetMessageMode()}));
    });
  }

  static async mgmeRollThreadsList() {
    MGMEChatJournal._mgmeFindOrCreateRolltable('Threads List', 'Mythic Lists').then(table => {
      table.normalize().then((t) => t.draw({messageMode: MGMECommon._mgmeGetMessageMode()}));
    });
  }

  static async mgmeFormattedChat() {
    const tokens = game?.scenes?.active?.tokens?.contents || [];

    const formattedChatDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-formattedchat-dialog.hbs', {})

    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.FormattedText')},
      content: formattedChatDialog,
      render: (event, dialog) => {
        const root = dialog.element;
        const curSpeaker = ChatMessage.getSpeaker();
        const speakerElement = root.querySelector("#mgme_format_speaker");
        speakerElement.insertAdjacentHTML('beforeend', `<option value="curr_user">${game.user.name}</option>`);
        tokens.forEach(token => {
          if (token.actor)
            speakerElement.insertAdjacentHTML('beforeend', `<option value=${token.actor.id} selected>${token.name}</option>`);
        });
        speakerElement.value = curSpeaker.actor ?? curSpeaker.alias;
        root.querySelector("#mgme_format_text")?.focus()
      },
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-comments',
          label: game.i18n.localize('MGME.ToChat'),
          callback: (event, button) => {
            const form = button.form;
            let message;
            let color = form.querySelector("#mgme_format_color").value?.trim();
            if (color && color !== '') {
              color = `style="color:${color};"`;
            } else {
              `style="color:inherit;"`;
            }
            let text = form.querySelector("#mgme_format_text").value?.trim();
            if (!text || text === '') return;
            switch (form.querySelector("#mgme_format_style").value?.trim()) {
              case '':
              case 'normal':
              case undefined: {
                message = `<span ${color}>${text}</span>`;
                break;
              }
              case 'title': {
                message = `<h1 ${color}>${text}</h1>`;
                break;
              }
              case 'subtitle': {
                message = `<h2 ${color}>${text}</h2>`;
                break;
              }
              case 'bold': {
                message = `<b ${color}>${text}</b>`;
                break;
              }
              case 'italic': {
                message = `<em ${color}>${text}</em>`;
                break;
              }
              case 'underline': {
                message = `<u ${color}>${text}</u>`;
                break;
              }
            }

            const speakerElementVal = form.querySelector("#mgme_format_speaker").value?.trim();
            const selectedSpeaker = speakerElementVal === 'curr_user' ? {alias: game.user.name} : {actor: tokens.find(t => t.actor.id === speakerElementVal).actor.id};
            let chatConfig = {
              content: message,
              speaker: selectedSpeaker,
              whisper: MGMECommon._mgmeGetWhisperMode()
            };
            MGMEChatJournal._mgmeCreateChatAndLog(chatConfig);
          },
          default: true
        }
      ]
    });
  }

  static async _mgmeExternallRollTableRoll(rolls, tableName) {
    if (!rolls?.length) return;
    const rollTotals = rolls.map(r => r.total);
    const outputRollDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-externalroll2-dialog.hbs', {rollTotals: rollTotals});

    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.ExternalRollTableOutcome')},
      content: outputRollDialog,
      render: (event, dialog) => {
        dialog.element.querySelector("#mgme_ext_roll_table_name").value = tableName;
        dialog.element.querySelector("#mgme_ext_roll_outcome")?.focus();
      },
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-comments',
          label: game.i18n.localize('MGME.ToChat'),
          callback: (event, button) => {
            const form = button.form;
            const debug = game.settings.get('mythic-gme-tools', 'mythicRollDebug');
            const textFlavor = form.querySelector("#mgme_ext_roll_flavor").value?.trim();
            const textOutcome = form.querySelector("#mgme_ext_roll_outcome").value?.trim();
            const whisper = MGMECommon._mgmeGetWhisperMode();
            if (textOutcome.length)
              MGMEChatJournal._mgmeCreateChatAndLog({
                flavor: tableName.length ? tableName : game.i18n.localize('MGME.ExternalTableCheck'),
                content: `${textFlavor.length ? `<h2>${textFlavor}</h2>` : ''}${textOutcome}${debug ? ` (${rolls[0].formula} = ${rollTotals})` : ''}`,
                whisper: whisper
              });
          },
          default: true
        }
      ]
    });
  }

  static async mgmeExternalRollTable() {
    const externalRollDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-externalroll1-dialog.hbs', {});

    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.ExternalRollTable')},
      content: externalRollDialog,
      render: (event, dialog) => dialog.element.querySelector("#mgme_ext_table_name")?.focus(),
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-dice',
          label: 'Roll',
          callback: async (event, button) => {
            const form = button.form;
            const tableName = form.querySelector("#mgme_ext_table_name").value?.trim();
            const formula = form.querySelector("#mgme_ext_formula").value?.trim();
            const howMany = parseInt(form.querySelector("#mgme_ext_many").value?.trim());
            const rolls = [];
            let i = 0;
            while (i < howMany) {
              const roll = Roll.create(formula.length ? formula : '1d100');
              await roll.roll().then(async r => {
                if (game.dice3d) {
                  await game.dice3d.showForRoll(r);
                }
                rolls.push(r);
              });
              i += 1;
            }
            MGMEChatExtras._mgmeExternallRollTableRoll(rolls, tableName);
          },
          default: true
        }
      ]
    });
  }

  static async mgmeFlavoredRollTable() {
    const rollDialog = await renderTemplate('./modules/mythic-gme-tools/template/extras-flavortable-dialog.hbs', {});
    const numEntries = 5;

    await DialogV2.wait({
      rejectClose: false,
      window: {title: game.i18n.localize('MGME.RollTableFlavorTitle')},
      content: rollDialog,
      render: (event, dialog) => {
        const root = dialog.element;
        const tables = game.tables.contents.map(t => t.name);
        tables.sort()
        let i = 0;
        while (i < numEntries) {
          i += 1;
          tables.forEach(t => root.querySelector("#mgme_table_select_" + i).insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`));
        }
        root.querySelector("#mgme_table_question")?.focus();
      },
      buttons: [
        {
          action: 'submit',
          icon: 'fas fa-comments',
          label: game.i18n.localize('MGME.ToChat'),
          callback: async (event, button) => {
            const form = button.form;
            const tableQuestion = form.querySelector("#mgme_table_question").value?.trim();
            let content = `${tableQuestion.length ? `<h2>${tableQuestion}</h2>` : ''}`;
            const debug = game.settings.get('mythic-gme-tools', 'mythicRollDebug');
            const whisper = MGMECommon._mgmeGetWhisperMode();
            let i = 0;
            while (i < numEntries) {
              i += 1;
              const selectedTable = form.querySelector("#mgme_table_select_"+i).value?.trim();
              const many = parseInt(form.querySelector("#mgme_table_many_"+i).value?.trim());
              const formula = form.querySelector("#mgme_table_formula_"+i).value?.trim();
              const table = game.tables.contents.find(t => t.name === selectedTable);
              if (selectedTable?.length && table) {
                content += `<b>${selectedTable}</b>`;
                await table.drawMany(many, {roll: Roll.create(formula?.length ? formula : table.formula), displayChat: false}).then(draw => {
                  let ii = 0;
                  for (const result of draw.results) {
                    content += `<div>${result.description}${debug ? ` (${draw.roll.terms[0].results[ii].result})` : ''}</div>`
                    ii += 1;
                  }
                });
              }
            }
            MGMEChatJournal._mgmeCreateChatAndLog({
              whisper: whisper,
              flavor: game.i18n.localize('MGME.RollTableFlavorTitle'),
              content: content
            });
          },
          default: true
        }
      ]
    });
  }

}
