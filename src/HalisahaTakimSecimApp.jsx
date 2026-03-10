import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Users, Crown } from "lucide-react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";

/*
 ULTRA MODERN HALISAHA DRAFT UI
 Mobile-first
 Glassmorphism
 Gradient lighting
 Smooth micro animations
*/


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
  "Ahmet","Mehmet","Can","Emre","Mert","Burak","Kaan","Ege","Ozan","Kerem","Yusuf","Onur","Deniz","Tuna",
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
  return !Object.values(firebaseConfig).some(v => String(v).startsWith("BURAYA_"));
}

function getFirebaseDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function normalizeDraft(raw) {
  const base = createInitialDraft();
  return {
    players: raw?.players || base.players,
    teams: {
      Arda: raw?.teams?.Arda || [],
      Bora: raw?.teams?.Bora || [],
    },
    currentCaptain: raw?.currentCaptain || null,
    started: Boolean(raw?.started),
    finished: Boolean(raw?.finished),
    updatedAt: raw?.updatedAt || Date.now(),
  };
}

function getAvailablePlayers(draft) {
  const used = [...draft.teams.Arda, ...draft.teams.Bora];
  return draft.players.filter(p => !used.includes(p));
}

function buildCaptainSelectionDraft(currentDraft, captain) {
  const normalized = normalizeDraft(currentDraft);
  return {
    ...normalized,
    started: true,
    currentCaptain: normalized.currentCaptain || captain,
    updatedAt: Date.now(),
  };
}

function buildPlayerSelectionDraft(currentDraft, player) {
  const draft = normalizeDraft(currentDraft);

  const captain = draft.currentCaptain;
  const team = draft.teams[captain];

  if (!captain) return draft;
  if (team.length >= MAX_PER_TEAM) return draft;

  const nextTeams = {
    ...draft.teams,
    [captain]: [...team, player],
  };

  let nextCaptain = getNextCaptain(captain);
  let finished = false;

  if (
    nextTeams.Arda.length === MAX_PER_TEAM &&
    nextTeams.Bora.length === MAX_PER_TEAM
  ) {
    finished = true;
    nextCaptain = null;
  }

  return {
    ...draft,
    teams: nextTeams,
    currentCaptain: nextCaptain,
    finished,
    updatedAt: Date.now(),
  };
}

export default function HalisahaTakimSecimApp() {
  const [draft, setDraft] = useState(createInitialDraft());
  const [selectedCaptain, setSelectedCaptain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const availablePlayers = useMemo(() => getAvailablePlayers(draft), [draft]);

  useEffect(() => {
    async function init() {
      const db = getFirebaseDb();
      const ref = doc(db, "draftRooms", ROOM_ID);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, createInitialDraft());
      }

      onSnapshot(ref, s => {
        if (s.exists()) setDraft(normalizeDraft(s.data()));
        setLoading(false);
      });
    }

    if (isFirebaseConfigured()) init();
    else setLoading(false);
  }, []);

  async function writeDraft(next) {
    const db = getFirebaseDb();
    const ref = doc(db, "draftRooms", ROOM_ID);
    await setDoc(ref, next);
  }

  async function chooseCaptain(captain) {
    setSelectedCaptain(captain);

    const db = getFirebaseDb();
    const ref = doc(db, "draftRooms", ROOM_ID);
    const snap = await getDoc(ref);

    const current = snap.exists() ? snap.data() : createInitialDraft();

    const next = buildCaptainSelectionDraft(current, captain);

    await writeDraft(next);
  }

  async function pickPlayer(player) {
    const db = getFirebaseDb();
    const ref = doc(db, "draftRooms", ROOM_ID);

    const snap = await getDoc(ref);

    const fresh = snap.exists() ? snap.data() : createInitialDraft();

    if (fresh.currentCaptain !== selectedCaptain) return;

    const next = buildPlayerSelectionDraft(fresh, player);

    await writeDraft(next);
  }

  async function refreshDraft() {
    setSyncing(true);

    const db = getFirebaseDb();
    const ref = doc(db, "draftRooms", ROOM_ID);
    const snap = await getDoc(ref);

    if (snap.exists()) setDraft(normalizeDraft(snap.data()));

    setSyncing(false);
  }

  const canPick =
    selectedCaptain &&
    draft.started &&
    draft.currentCaptain === selectedCaptain;

  if (loading) return <div className="min-h-screen bg-black" />;

  /* CAPTAIN SELECT */

  if (!selectedCaptain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-black to-slate-900 text-white">

        <div className="flex flex-col gap-6 items-center">

          <div className="text-3xl font-bold tracking-tight">Takım Seç</div>

          <div className="flex gap-6">

            {CAPTAINS.map(c => (

              <motion.button
                key={c}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => chooseCaptain(c)}
                className="px-12 py-10 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl text-2xl font-semibold"
              >
                <Crown className="inline mr-2" />
                {c}
              </motion.button>

            ))}

          </div>

        </div>

      </div>
    );
  }

  /* MAIN UI */

  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-indigo-950 text-white">

      <div className="max-w-6xl mx-auto p-4 md:p-10">

        {/* HEADER */}

        <div className="flex items-center justify-between mb-6">

          <div className="flex items-center gap-3 text-sm opacity-70">
            <Users size={18} />
            {selectedCaptain} | sıra: {draft.currentCaptain}
          </div>

          <button
            onClick={refreshDraft}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl"
          >
            <RefreshCcw size={16} className={syncing ? "animate-spin" : ""} />
            Güncelle
          </button>

        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* PLAYER POOL */}

          <div className="lg:col-span-1 bg-white/5 backdrop-blur-xl rounded-3xl p-4">

            <div className="mb-4 font-semibold text-lg">Oyuncular</div>

            <div className="grid grid-cols-2 gap-3">

              {availablePlayers.map(player => (

                <motion.button
                  key={player}
                  whileHover={canPick ? { scale: 1.05 } : {}}
                  whileTap={canPick ? { scale: 0.95 } : {}}
                  disabled={!canPick}
                  onClick={() => pickPlayer(player)}
                  className={`p-4 rounded-xl text-left ${
                    canPick
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                      : "bg-white/5 opacity-40"
                  }`}
                >
                  {player}
                </motion.button>

              ))}

            </div>

          </div>

          {/* TEAMS */}

          {CAPTAINS.map(captain => {

            const team = draft.teams[captain];
            const active = draft.currentCaptain === captain;

            return (

              <div
                key={captain}
                className={`bg-white/5 backdrop-blur-xl rounded-3xl p-4 ${
                  active ? "ring-2 ring-indigo-500" : ""
                }`}
              >

                <div className="flex items-center justify-between mb-4">

                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Crown size={18} />
                    {captain}
                  </div>

                  <div className="text-sm opacity-70">{team.length}/7</div>

                </div>

                <div className="space-y-2">

                  {team.map((p, i) => (

                    <motion.div
                      key={p}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/10 rounded-xl p-3 flex justify-between"
                    >
                      <span>{p}</span>
                      <span className="opacity-50">#{i + 1}</span>
                    </motion.div>

                  ))}

                </div>

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );
}
