/** Reuse the pinned host's single SettingsRoot, including its dialog state. */
export function openHostSettings(document) {
 const button=document.querySelector('.hHd-Xa_settingsArea button[aria-haspopup="dialog"]');
 if(!button)throw new Error('CRYSTRA_HOST_SETTINGS_LAYOUT_UNSUPPORTED');
 button.click();
}
