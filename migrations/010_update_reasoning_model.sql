-- Update reasoning model from removed deepseek-r1 to deepseek-v4-pro
-- The deepseek/deepseek-r1 model was removed from OpenRouter

update settings
set value = 'deepseek/deepseek-v4-pro'
where key = 'reasoningModel'
  and value = 'deepseek/deepseek-r1';
