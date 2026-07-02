import { loadFont as loadSpectral } from "@remotion/google-fonts/Spectral";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

/**
 * Load canvas fonts inside the Remotion tree so they exist in both the
 * browser Player and the headless renderer (MP4 export). next/font only
 * covers the app chrome.
 */
export function loadStageFonts() {
  loadSpectral("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
  loadSpectral("italic", { weights: ["400", "500"], subsets: ["latin"] });
  loadInterTight("normal", { weights: ["400", "500"], subsets: ["latin"] });
  loadJetBrainsMono("normal", { weights: ["400"], subsets: ["latin"] });
}
