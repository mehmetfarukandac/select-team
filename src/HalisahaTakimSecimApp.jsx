import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCcw } from "lucide-react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCGoF5dq2apc5rjLefkX81rJ-KGsFYtI9M",
    authDomain: "select-team-a5981.firebaseapp.com",
    projectId: "select-team-a5981",
    storageBucket: "select-team-a5981.firebasestorage.app",
    messagingSenderId: "581590674074",
    appId: "1:581590674074:web:c3c2dd3345445ed4ac0d23",
    measurementId: "G-6WPHDN0VBH"
  };

const DEFAULT_PLAYERS = [
  "Andaç",
  "Ant",
  "Baki",
  "Ferhat",
  "Umur",
  "Burak",
  "Adil",
  "Murat",
  "Özgür",
  "Hüseyin",
  "Kişi 11",
  "Kişi 12"
];

const CAPTAINS = ["Arda", "Bora"];
const ROOM_ID = "oda-1";
const MAX_PER_TEAM = 7;

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getNextCaptain(current) {
  return current === "Arda" ? "Bora" : "Arda";
}

function createInitialDraft() {
  return {
    players: shuffleArray(DEFAULT_PLAYERS),
    teams: { Arda: [], Bora: [] },
    currentCaptain: null,
    started: false,
    finished: false,
    updatedAt: Date.now(),
  };
}

function isFirebaseConfigured() {
  return !Object.values(firebaseConfig).some((value) =>
    String(value).startsWith("BURAYA_")
  );
}

function getFirebaseDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function Button({ className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-2xl px-4 py-3 font-medium transition ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ className = "", children }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm ${className}`}>{children}</span>
  );
}

export default function HalisahaTakimSecimApp() {
  const [draft, setDraft] = useState(createInitialDraft());
  const [loading, setLoading] = useState(true);
  const [selectedCaptain, setSelectedCaptain] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  const availablePlayers = useMemo(() => {
    const ardaTeam = draft?.teams?.Arda || [];
    const boraTeam = draft?.teams?.Bora || [];
    const players = draft?.players || [];

    return players.filter(
      (player) => !ardaTeam.includes(player) && !boraTeam.includes(player)
    );
  }, [draft]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      setLiveMode(false);
      return;
    }

    const db = getFirebaseDb();
    const roomRef = doc(db, "draftRooms", ROOM_ID);
    let unsubscribe = () => {};

    async function initRoom() {
      try {
        const snapshot = await getDoc(roomRef);

        if (!snapshot.exists()) {
          const initialDraft = createInitialDraft();
          await setDoc(roomRef, initialDraft);
          setDraft(initialDraft);
        } else {
          setDraft(snapshot.data());
        }

        unsubscribe = onSnapshot(
          roomRef,
          (liveSnapshot) => {
            if (liveSnapshot.exists()) {
              setDraft(liveSnapshot.data());
              setLiveMode(true);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore dinleme hatası:", error);
            setLiveMode(false);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Firestore başlangıç hatası:", error);
        setLiveMode(false);
        setLoading(false);
      }
    }

    initRoom();

    return () => unsubscribe();
  }, []);

  async function refreshDraft() {
    if (!isFirebaseConfigured()) return;

    try {
      setSyncing(true);
      const db = getFirebaseDb();
      const roomRef = doc(db, "draftRooms", ROOM_ID);
      const snapshot = await getDoc(roomRef);

      if (snapshot.exists()) {
        setDraft(snapshot.data());
      }
    } catch (error) {
      console.error("Güncel seçimleri çekerken hata:", error);
    } finally {
      setSyncing(false);
    }
  }

  async function saveDraft(nextDraft) {
    setDraft(nextDraft);

    if (!isFirebaseConfigured()) {
      setLiveMode(false);
      return;
    }

    try {
      const db = getFirebaseDb();
      const roomRef = doc(db, "draftRooms", ROOM_ID);
      await setDoc(roomRef, nextDraft);
      setLiveMode(true);
    } catch (error) {
      console.error("Firestore yazma hatası:", error);
    }
  }

  async function chooseCaptain(captain) {
    setSelectedCaptain(captain);

    try {
      const db = getFirebaseDb();
      const roomRef = doc(db, "draftRooms", ROOM_ID);
      const snapshot = await getDoc(roomRef);

      const currentDraft = snapshot.exists()
        ? snapshot.data()
        : createInitialDraft();

      const nextDraft = {
        ...currentDraft,
        started: true,
        currentCaptain: currentDraft.currentCaptain || captain,
        finished: false,
        updatedAt: Date.now(),
      };

      await saveDraft(nextDraft);
    } catch (error) {
      console.error("Kaptan seçimi yazma hatası:", error);
    }
  }

  async function pickPlayer(player) {
    if (!selectedCaptain) return;
    if (!draft.started || draft.finished || !draft.currentCaptain) return;
    if (draft.currentCaptain !== selectedCaptain) return;

    const db = getFirebaseDb();
    const roomRef = doc(db, "draftRooms", ROOM_ID);
    const snapshot = await getDoc(roomRef);
    const freshDraft = snapshot.exists() ? snapshot.data() : draft;

    if (!freshDraft.started || freshDraft.finished || !freshDraft.currentCaptain) return;
    if (freshDraft.currentCaptain !== selectedCaptain) return;

    const currentTeam = freshDraft.teams?.[freshDraft.currentCaptain] || [];
    const ardaTeam = freshDraft.teams?.Arda || [];
    const boraTeam = freshDraft.teams?.Bora || [];
    const freshAvailablePlayers = (freshDraft.players || []).filter(
      (name) => !ardaTeam.includes(name) && !boraTeam.includes(name)
    );

    if (currentTeam.length >= MAX_PER_TEAM) return;
    if (!freshAvailablePlayers.includes(player)) return;

    const nextTeams = {
      ...freshDraft.teams,
      [freshDraft.currentCaptain]: [...currentTeam, player],
    };

    const otherCaptain = getNextCaptain(freshDraft.currentCaptain);
    const totalPicked = nextTeams.Arda.length + nextTeams.Bora.length;

    let nextCaptain = otherCaptain;
    let finished = false;

    if (nextTeams[otherCaptain].length >= MAX_PER_TEAM) {
      nextCaptain = freshDraft.currentCaptain;
    }

    if (
      nextTeams.Arda.length === MAX_PER_TEAM &&
      nextTeams.Bora.length === MAX_PER_TEAM
    ) {
      finished = true;
      nextCaptain = null;
    }

    if (totalPicked >= (freshDraft.players || []).length) {
      finished = true;
      nextCaptain = null;
    }

    await saveDraft({
      ...freshDraft,
      teams: nextTeams,
      currentCaptain: nextCaptain,
      finished,
      updatedAt: Date.now(),
    });
  }

  const canPick =
    !!selectedCaptain &&
    draft.started &&
    !draft.finished &&
    draft.currentCaptain === selectedCaptain;

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!selectedCaptain) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center p-6 md:p-10">
          <div className="flex flex-wrap justify-center gap-4">
            {CAPTAINS.map((captain) => (
              <Button
                key={captain}
                onClick={() => chooseCaptain(captain)}
                className="bg-white px-10 py-8 text-2xl text-slate-950 hover:bg-white/90"
              >
                {captain}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-white/40">
            {selectedCaptain} / {liveMode ? "firebase" : "yerel"} / sıra: {String(draft.currentCaptain)} / başladı: {String(draft.started)}
          </div>
          <Button
            onClick={refreshDraft}
            disabled={syncing}
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mr-2 inline-flex align-middle">
              <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            </span>
            Güncel seçimleri getir
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <Card className="text-white shadow-2xl shadow-black/20">
            <div className="p-4 md:p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {availablePlayers.map((player) => (
                  <motion.button
                    whileHover={canPick ? { y: -2 } : undefined}
                    whileTap={canPick ? { scale: 0.98 } : undefined}
                    key={player}
                    disabled={!canPick}
                    onClick={() => pickPlayer(player)}
                    className={`rounded-2xl border p-5 text-left text-lg transition ${
                      canPick
                        ? "border-white/10 bg-slate-900/80 hover:border-white/20 hover:bg-slate-900"
                        : "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
                    }`}
                  >
                    <span className="font-medium">{player}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </Card>

          {CAPTAINS.map((captain) => {
            const isActive = draft.currentCaptain === captain && !draft.finished;
            const isMe = selectedCaptain === captain;
            const team = draft.teams?.[captain] || [];

            return (
              <Card
                key={captain}
                className={`text-white shadow-2xl shadow-black/20 transition ${
                  isActive ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="p-4 md:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-2xl font-semibold">{captain}</div>
                    <div className="flex items-center gap-2">
                      {isMe && <Badge className="bg-white/10 text-white">sen</Badge>}
                      <Badge className="bg-white/10 text-white">{team.length}/7</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {team.map((player, index) => (
                      <motion.div
                        key={player}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{player}</span>
                          <Badge className="bg-white/10 text-white">#{index + 1}</Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
