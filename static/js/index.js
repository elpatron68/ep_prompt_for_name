'use strict';

const hasName = () => {
  const n = pad && pad.myUserInfo && pad.myUserInfo.name;
  return !!(n && String(n).trim() && !isPlaceholderName(n));
};

const isPlaceholderName = (name) => {
  const n = String(name || '').trim();
  if (!n) return true;
  // Localized placeholders / empty labels that must never be persisted as a real name.
  const placeholders = new Set();
  try {
    placeholders.add(html10n.get('pad.userlist.entername'));
    placeholders.add(html10n.get('pad.userlist.unnamed'));
  } catch (e) {
    // ignore
  }
  placeholders.add('Dein Name?');
  placeholders.add('Enter your name');
  placeholders.add('Your name');
  placeholders.add('unnamed');
  placeholders.add('Unbenannt');
  return placeholders.has(n);
};

const getPadUserList = () => {
  try {
    // Bundled client modules are require()-able from plugins.
    const mod = require('ep_etherpad-lite/static/js/pad_userlist');
    if (mod && mod.paduserlist) return mod.paduserlist;
  } catch (e) {
    // ignore
  }
  if (typeof paduserlist !== 'undefined') return paduserlist;
  return null;
};

const syncUserListName = () => {
  const list = getPadUserList();
  if (!list || !list.setMyUserInfo) return;
  list.setMyUserInfo($.extend({}, pad.myUserInfo));
};

const normalizeNameField = () => {
  const $input = $('#myusernameedit');
  if (!$input.length) return;
  // html10n writes the translation into the value for data-l10n-id inputs.
  // That makes "Dein Name?" look like a real username and gets persisted on blur.
  $input.removeAttr('data-l10n-id');
  const current = String($input.val() || '').trim();
  if (!hasName() && isPlaceholderName(current)) {
    $input.val('');
  }
  if (hasName()) {
    $input.removeClass('editempty').val(pad.myUserInfo.name);
    $input.removeAttr('placeholder');
  } else {
    try {
      $input.attr('placeholder', html10n.get('pad.userlist.entername'));
    } catch (e) {
      $input.attr('placeholder', 'Dein Name?');
    }
    $input.addClass('editempty');
  }
};

const ensureCss = () => {
  if ($('#ep_prompt_for_name_css').length) return;
  $('head').append(
      '<link id="ep_prompt_for_name_css" rel="stylesheet" ' +
      'href="../static/plugins/ep_prompt_for_name/static/css/dialog.css">');
};

const applyName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed || isPlaceholderName(trimmed)) return false;

  pad.myUserInfo.name = trimmed;
  pad.notifyChangeName(trimmed);
  syncUserListName();
  normalizeNameField();
  return true;
};

const removeDialog = () => {
  $('#ep_prompt_for_name_overlay').remove();
};

const showNameDialog = () => {
  if (hasName()) return;
  if ($('#ep_prompt_for_name_overlay').length) return;
  ensureCss();
  normalizeNameField();

  const titleRaw = (window.html10n && html10n.get('ep_prompt_for_name.dialog.title')) || '';
  const hintRaw = (window.html10n && html10n.get('ep_prompt_for_name.dialog.hint')) || '';
  const saveRaw = (window.html10n && html10n.get('ep_prompt_for_name.dialog.save')) || '';
  const placeholder = (window.html10n && html10n.get('pad.userlist.entername')) || 'Dein Name?';

  const clean = (value, fallback) =>
    (!value || String(value).indexOf('ep_prompt_for_name.') === 0) ? fallback : value;

  const $overlay = $(`
    <div id="ep_prompt_for_name_overlay" role="dialog" aria-modal="true" aria-labelledby="ep_prompt_for_name_title">
      <div id="ep_prompt_for_name_dialog">
        <h2 id="ep_prompt_for_name_title"></h2>
        <p id="ep_prompt_for_name_hint"></p>
        <input id="ep_prompt_for_name_input" type="text" autocomplete="nickname" maxlength="50" />
        <div id="ep_prompt_for_name_actions">
          <button type="button" id="ep_prompt_for_name_save" class="ep_prompt_for_name_primary"></button>
        </div>
      </div>
    </div>
  `);

  $overlay.find('#ep_prompt_for_name_title').text(clean(titleRaw, 'Wie heißt du?'));
  $overlay.find('#ep_prompt_for_name_hint').text(clean(
      hintRaw,
      'Dein Name wird anderen auf diesem Pad angezeigt und für den nächsten Besuch gespeichert.'));
  $overlay.find('#ep_prompt_for_name_input').attr('placeholder', placeholder);
  $overlay.find('#ep_prompt_for_name_save').text(clean(saveRaw, 'Speichern'));
  $('body').append($overlay);

  const $input = $('#ep_prompt_for_name_input');
  const submit = () => {
    if (applyName($input.val())) {
      removeDialog();
    } else {
      $input.addClass('ep_prompt_for_name_invalid').trigger('focus');
    }
  };

  $('#ep_prompt_for_name_save').on('click', submit);
  $input.on('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  setTimeout(() => $input.trigger('focus'), 50);
};

const openUsersPopupFallback = () => {
  if (hasName()) return;
  normalizeNameField();
  $('#users').addClass('popup-show');
  const $input = $('#myusernameedit');
  if ($input.length) $input.trigger('focus');
};

const clearPlaceholderAuthorNameIfNeeded = () => {
  // If a previous bug persisted the placeholder as the author name, clear it
  // locally and on the server so the dialog can ask again.
  if (!pad || !pad.myUserInfo) return;
  if (!isPlaceholderName(pad.myUserInfo.name)) return;
  pad.myUserInfo.name = null;
  pad.notifyChangeName('');
  syncUserListName();
  normalizeNameField();
};

exports.postAceInit = () => {
  clearPlaceholderAuthorNameIfNeeded();
  normalizeNameField();

  setTimeout(() => {
    if (!hasName()) showNameDialog();
  }, 400);

  // Keep userlist field in sync if core re-renders while our dialog is open/closed.
  $(document).on('click.ep_prompt_for_name', 'li[data-key=showusers] > a', () => {
    setTimeout(normalizeNameField, 0);
  });

  try {
    const innerWindow = window.frames.ace_outer.frames.ace_inner;
    let timer;
    innerWindow.$(innerWindow.document).on('keyup.ep_prompt_for_name', () => {
      if (hasName()) return;
      if ($('#ep_prompt_for_name_overlay').length) return;
      innerWindow.clearTimeout(timer);
      timer = innerWindow.setTimeout(openUsersPopupFallback, 5000);
    });
  } catch (e) {
    // ignore
  }
};

exports.aceInitialized = () => {};
