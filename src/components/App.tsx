"use client";

import { useEffect } from "react";
import { useGame } from "@/store/game-store";
import { TitleScreen } from "./TitleScreen";
import { LevelSelect } from "./LevelSelect";
import { GameScreen } from "./GameScreen";

export function App() {
  const screen = useGame((s) => s.screen);
  const hydrate = useGame((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);

  if (screen === "levels") return <LevelSelect />;
  if (screen === "game") return <GameScreen />;
  return <TitleScreen />;
}
