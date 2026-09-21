// Full-screen Local mods: install a mod from a file on the device instead of
// from Nexus - your own build, a private mod. Files are dropped in
// ~/local-mods; the backend lists them, and installing one runs the same
// pipeline as a Nexus download (see docs/local-install.md).
import {
  DialogButton,
  Dropdown,
  Focusable,
  ScrollPanelGroup,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useState } from "react";

import { LocalModFile, installLocalMod, listLocalMods } from "./api";
import { PayloadChoiceModal } from "./ChoiceModal";
import { ALL_GAMES, SupportedGame, modeParams } from "./games";
import {
  PAGE_SCROLLER,
  PRIMARY_BUTTON_CLASS,
  PRIMARY_BUTTON_CSS,
} from "./theme";
import { TabBar, exitTabsToQam, handleTabButtons } from "./Tabs";

const Scroller: any = ScrollPanelGroup;

/** Games a local install can target. Only the Data-folder (Bethesda-style)
 * games so far: the backend call does not carry the extra layout settings
 * the UE4SS, Witcher, Cyberpunk and pak-patch games need to route a mod. */
export const LOCAL_GAMES: SupportedGame[] = ALL_GAMES.filter(
  (g) => g.installMode === "dataDir" && !g.frostbite
);

function modNameOf(fileName: string): string {
  return fileName.replace(/\.(zip|7z|rar|esm|esp|esl)$/i, "");
}

function sizeOf(bytes: number): string {
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} MB`;
  if (bytes >= 1 << 10) return `${Math.round(bytes / (1 << 10))} KB`;
  return `${bytes} B`;
}

export function LocalPage() {
  const [files, setFiles] = useState<LocalModFile[] | undefined>();
  const [dir, setDir] = useState("~/local-mods");
  const [error, setError] = useState("");
  const [appId, setAppId] = useState<number>(LOCAL_GAMES[0]?.appId ?? 0);
  const [busyFile, setBusyFile] = useState("");
  const game = LOCAL_GAMES.find((g) => g.appId === appId);

  const refresh = () =>
    listLocalMods()
      .then((r) => {
        if (r.ok) {
          setFiles(r.files ?? []);
          if (r.dir) setDir(r.dir);
          setError("");
        } else {
          setFiles([]);
          setError(r.error ?? "Couldn't read the folder");
        }
      })
      .catch((e) => {
        setFiles([]);
        setError(String(e));
      });
  useEffect(() => {
    refresh();
  }, []);

  const install = async (
    g: SupportedGame,
    f: LocalModFile,
    payloadChoice = ""
  ): Promise<void> => {
    const name = modNameOf(f.file_name);
    setBusyFile(f.file_name);
    try {
      const result = await installLocalMod(
        g.nexusDomain,
        f.file_name,
        name,
        "",
        g.installDirName,
        g.modsSubdir,
        ...modeParams(g),
        payloadChoice,
        g.flatModExtensions ?? [],
        g.processName ?? ""
      );
      if (result.ok) {
        toaster.toast({
          title: `${name} installed`,
          body: `Into ${g.displayName}. Manage it in My Mods; restart the game to load it.`,
        });
        return;
      }
      if (result.needs_choice && result.options?.length) {
        // Same as the Updates page: act rather than instruct. The pick
        // resumes this install.
        await new Promise<void>((resolve) => {
          const modal = showModal(
            <PayloadChoiceModal
              modName={name}
              options={result.options!}
              labels={result.option_labels}
              allowMerge={result.merge_allowed !== false}
              onPick={(opt) => resolve(install(g, f, opt))}
              closeModal={() => {
                modal.Close();
                setTimeout(() => resolve(), 0);
              }}
            />
          );
        });
        return;
      }
      if (result.needs_fomod) {
        toaster.toast({
          title: `${name} not installed`,
          body: "This archive uses an installer wizard, which local installs don't support yet.",
        });
        return;
      }
      toaster.toast({
        title: `${name} not installed`,
        body: result.error ?? "Unknown error",
      });
    } catch (e) {
      toaster.toast({ title: `${name} not installed`, body: String(e) });
    } finally {
      setBusyFile("");
    }
  };

  return (
    <Focusable
      // No autoFocus/onActivate here: the TabBar guarantees focusable
      // children, and a focusable root traps the gamepad focus.
      onButtonDown={handleTabButtons("local")}
      onCancel={exitTabsToQam}
      style={{ marginTop: "40px", height: "calc(100% - 40px)" }}
    >
      <Scroller
        focusable={false}
        onButtonDown={handleTabButtons("local")}
        style={PAGE_SCROLLER}
      >
        <style>{PRIMARY_BUTTON_CSS}</style>
        <TabBar currentId="local" />
        <h2 style={{ margin: "12px 0 4px" }}>Local mods</h2>
        <div style={{ fontSize: "12.5px", opacity: 0.65, marginBottom: "10px" }}>
          Install a mod from a file on this device instead of from Nexus. Copy
          a .zip, .7z, .rar, or a bare .esm / .esp into{" "}
          <code>{dir}</code>, then install it below. The file stays there, so
          you can reinstall it later. Local mods aren't checked for updates.
        </div>

        <div style={{ maxWidth: "360px", margin: "0 0 12px" }}>
          <Dropdown
            rgOptions={LOCAL_GAMES.map((g) => ({
              data: g.appId,
              label: g.displayName,
            }))}
            selectedOption={appId}
            onChange={(opt) => setAppId(opt.data)}
            strDefaultLabel="Install into…"
          />
        </div>

        {error && (
          <div style={{ color: "#e5734a", margin: "0 0 10px" }}>{error}</div>
        )}
        {files === undefined && <div style={{ opacity: 0.8 }}>Looking…</div>}
        {files !== undefined && files.length === 0 && !error && (
          <div style={{ opacity: 0.8 }}>
            Nothing in <code>{dir}</code> yet.
          </div>
        )}

        <Focusable style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {(files ?? []).map((f) => (
            <Focusable
              key={f.file_name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
              }}
            >
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.file_name}
                </div>
                <div style={{ fontSize: "12px", opacity: 0.65 }}>
                  {sizeOf(f.size)}
                </div>
              </div>
              <DialogButton
                className={PRIMARY_BUTTON_CLASS}
                disabled={!game || busyFile !== ""}
                onClick={() => game && install(game, f)}
                style={{
                  minWidth: "0",
                  width: "auto",
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  flexShrink: 0,
                }}
              >
                {busyFile === f.file_name ? "Installing…" : "Install"}
              </DialogButton>
            </Focusable>
          ))}
        </Focusable>

        <Focusable style={{ margin: "14px 0 0", maxWidth: "220px" }}>
          <DialogButton disabled={busyFile !== ""} onClick={refresh}>
            Refresh list
          </DialogButton>
        </Focusable>
      </Scroller>
    </Focusable>
  );
}
