"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 18;
const ROWS = 18;
const START = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
type Direction = keyof typeof DIRECTIONS;
type Point = { x: number; y: number };

function randomFood(snake: Point[]) {
  const free: Point[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!snake.some((part) => part.x === x && part.y === y)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 2, y: 2 };
}

export default function Home() {
  const [snake, setSnake] = useState<Point[]>(START);
  const [food, setFood] = useState<Point>({ x: 13, y: 9 });
  const [direction, setDirection] = useState<Direction>("right");
  const [status, setStatus] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const directionRef = useRef<Direction>("right");

  useEffect(() => {
    setBest(Number(localStorage.getItem("snake-best") ?? 0));
  }, []);

  const start = useCallback(() => {
    if (status === "over" || status === "ready") {
      setSnake(START);
      setFood({ x: 13, y: 9 });
      setScore(0);
      setDirection("right");
      directionRef.current = "right";
    }
    setStatus("playing");
  }, [status]);

  const turn = useCallback((next: Direction) => {
    const current = DIRECTIONS[directionRef.current];
    const wanted = DIRECTIONS[next];
    if (current.x + wanted.x === 0 && current.y + wanted.y === 0) return;
    directionRef.current = next;
    setDirection(next);
    setStatus((value) => value === "ready" ? "playing" : value);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
      };
      if (keyMap[event.key]) {
        event.preventDefault();
        turn(keyMap[event.key]);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setStatus((value) => value === "playing" ? "paused" : "playing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  useEffect(() => {
    if (status !== "playing") return;
    const speed = Math.max(72, 175 - score * 4);
    const timer = window.setInterval(() => {
      setSnake((current) => {
        const vector = DIRECTIONS[directionRef.current];
        const head = {
          x: current[0].x + vector.x,
          y: current[0].y + vector.y,
        };
        const crashed = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS
          || current.some((part) => part.x === head.x && part.y === head.y);
        if (crashed) {
          setStatus("over");
          setBest((oldBest) => {
            const nextBest = Math.max(oldBest, score);
            localStorage.setItem("snake-best", String(nextBest));
            return nextBest;
          });
          return current;
        }
        const ate = head.x === food.x && head.y === food.y;
        const next = [head, ...current];
        if (ate) {
          setScore((value) => value + 1);
          setFood(randomFood(next));
        } else {
          next.pop();
        }
        return next;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [food, score, status]);

  const occupied = new Map(snake.map((part, index) => [`${part.x}-${part.y}`, index]));

  return (
    <main>
      <section className="phone" aria-label="Nokia 3310 tarzı yılan oyunu">
        <div className="speaker"><span /><span /><span /><span /><span /></div>
        <div className="brand">NOKIA</div>
        <div className="screen-shell">
          <div className="screen">
            <header>
              <span>YILAN II</span>
              <span>SKOR {String(score).padStart(3, "0")}</span>
            </header>
            <div className="board" role="application" aria-label="Oyun alanı">
              {Array.from({ length: COLS * ROWS }, (_, index) => {
                const x = index % COLS;
                const y = Math.floor(index / COLS);
                const snakeIndex = occupied.get(`${x}-${y}`);
                const isFood = food.x === x && food.y === y;
                return <i key={index} className={`${snakeIndex !== undefined ? "snake" : ""} ${snakeIndex === 0 ? "head" : ""} ${isFood ? "food" : ""}`} />;
              })}
              {status !== "playing" && (
                <button className="message" onClick={start}>
                  {status === "over" ? <>OYUN BİTTİ<small>SKOR {score} · TEKRAR OYNA</small></>
                    : status === "paused" ? <>DURAKLATILDI<small>DEVAM ET</small></>
                    : <>YILAN II<small>BAŞLAMAK İÇİN BAS</small></>}
                </button>
              )}
            </div>
            <footer>REKOR {String(best).padStart(3, "0")} · HIZ {Math.min(9, 1 + Math.floor(score / 4))}</footer>
          </div>
        </div>
        <div className="softkeys">
          <button onClick={start}>SEÇ</button>
          <button onClick={() => setStatus((value) => value === "playing" ? "paused" : "playing")}>GERİ</button>
        </div>
        <div className="controls" aria-label="Yön tuşları">
          <button className="up" onClick={() => turn("up")} aria-label="Yukarı">▲</button>
          <button className="left" onClick={() => turn("left")} aria-label="Sol">◀</button>
          <button className="center" onClick={() => setStatus((value) => value === "playing" ? "paused" : "playing")} aria-label="Duraklat">●</button>
          <button className="right" onClick={() => turn("right")} aria-label="Sağ">▶</button>
          <button className="down" onClick={() => turn("down")} aria-label="Aşağı">▼</button>
        </div>
        <p className="hint">OK TUŞLARI / WASD · BOŞLUK: DURAKLAT</p>
      </section>
    </main>
  );
}
