'use strict';

const eejs = require('ep_etherpad-lite/node/eejs');

exports.eejsBlock_styles = (hookName, context) => {
  context.content +=
      '<link rel="stylesheet" href="../static/plugins/ep_prompt_for_name/static/css/dialog.css">';
};
