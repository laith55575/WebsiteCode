"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"; // استيراد useRef
import { Chessboard } from "react-chessboard";
import { Chess, Square, ChessInstance, ShortMove } from "chess.js";
import {
  OptionSquares,
  RightClickedSquares,
  convertCSSPropertiesToStringObject,
} from "@/public/utils/types";
import { useBoardStore } from "@/app/store";
import { useSearchParams } from "next/navigation";
import { BoardOrientation } from "react-chessboard/dist/chessboard/types";
import { GameModal } from ".";

class Engine {
  private stockfish: Worker | null;

  constructor() {
    this.stockfish =
      typeof Worker !== "undefined" ? new Worker("/stockfish.js") : null;
    this.onMessage = this.onMessage.bind(this);

    if (this.stockfish) {
      this.sendMessage("uci");
      this.sendMessage("isready");
    }
  }

  onMessage(callback: (data: { bestMove: string }) => void) {
    if (this.stockfish) {
      this.stockfish.addEventListener("message", (e) => {
        const bestMove = e.data?.match(/bestmove\s+(\S+)/)?.[1];
        callback({ bestMove });
      });
    }
  }

  evaluatePosition(fen: string, depth: number) {
    if (this.stockfish) {
      this.stockfish.postMessage(`position fen ${fen}`);
      this.stockfish.postMessage(`go depth ${depth}`);
    }
  }

  stop() {
    this.sendMessage("stop");
  }

  quit() {
    this.sendMessage("quit");
  }

  private sendMessage(message: string) {
    if (this.stockfish) {
      this.stockfish.postMessage(message);
    }
  }
}

const ChessboardBot: React.FC = () => {
  const engine = useMemo(() => new Engine(), []);
  const [game, setGame] = useState<ChessInstance>(new Chess());
  const theme = useBoardStore((state) => state.theme);
  const setMoves = useBoardStore((state) => state.setMoves);
  const setOnNewGame = useBoardStore((state) => state.setOnNewGame);
  const setGameOver = useBoardStore((state) => state.setGameOver);
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [rightClickedSquares, setRightClickedSquares] =
    useState<RightClickedSquares>({});
  const moveSquares = {};
  const [optionSquares, setOptionSquares] = useState<OptionSquares>({});
  const searchParams = useSearchParams();
  const stockfishLevel = Number(searchParams.get("stockfishLevel"));
  const playAs = searchParams.get("playAs");
  const [gameResult, setGameResult] = useBoardStore((state) => [
    state.gameResult,
    state.setGameResult,
  ]);
  const [showGameModal, setShowGameModal] = useState(false);
  
  // إضافة useRef لمراقبة حجم الـ div الحاوي للوح الشطرنج
  const chessboardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(560); // قيمة افتراضية

  useEffect(() => {
    if (playAs === "black") {
      makeStockfishMove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAs]);

  useEffect(() => {
    if (game.in_checkmate() || game.in_draw() || game.in_stalemate()) {
      if (game.in_checkmate()) {
        if (playAs === "black") {
          setGameResult(game.turn() === "w" ? "User wins!" : "StockFish wins!");
        } else {
          setGameResult(game.turn() === "w" ? "StockFish wins!" : "User wins!");
        }
      } else {
        setGameResult("It's a draw!");
      }
      setShowGameModal(true);
      setGameOver(true);
    } else {
      // إذا كانت اللعبة لم تنتهِ بعد، تأكد من عدم عرض نتيجة الاستسلام إلا إذا حدث استسلام فعلي
      // قد تحتاج لتعديل هذا الجزء إذا كنت تريد التحكم في "You Resigned!" بشكل أفضل
      // For now, let's just make sure we don't accidentally set it if the game is still active
      if (gameResult === "You Resigned!" && !game.game_over()) {
         setGameResult(""); // Reset if game is not over
      }
    }

    setMoves(game.history());
  }, [game, playAs, setMoves, setGameResult, setGameOver, gameResult]); // أضف gameResult كاعتماد

  function getMoveOptions(square: Square) {
    const moves = game.moves({
      square,
      verbose: true,
    });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: OptionSquares = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) &&
          game.get(move.to)!.color !== game.get(square)!.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
      borderRadius: "",
    };
    setOptionSquares(newSquares);
    return true;
  }

  const makeStockfishMove = useCallback(() => {
    engine.evaluatePosition(game.fen(), stockfishLevel);
    engine.onMessage(({ bestMove }) => {
      if (bestMove) {
        const move = game.move({
          from: bestMove.substring(0, 2) as Square,
          to: bestMove.substring(2, 4) as Square,
          promotion: bestMove.substring(4, 5) as
            | "b"
            | "n"
            | "r"
            | "q"
            | undefined,
        });

        if (move) {
          setGame(game);
        }
      }
    });
  }, [engine, game, setGame, stockfishLevel]);

  function onSquareClick(square: Square) {
    setRightClickedSquares({});

    if (!moveFrom) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    if (!moveTo) {
      const piece = game.get(moveFrom);
      const moves = game.moves({
        square: moveFrom,
        verbose: true,
      }) as ShortMove[];
      const foundMove = moves.find(
        (m) => m.from === moveFrom && m.to === square
      );
      if (!foundMove) {
        const hasMoveOptions = getMoveOptions(square);
        setMoveFrom(hasMoveOptions ? square : null);
        return;
      }

      setMoveTo(square);

      if (
        (piece?.color === "w" && piece?.type === "p" && square[1] === "8") ||
        (piece?.color === "b" && piece?.type === "p" && square[1] === "1")
      ) {
        setShowPromotionDialog(true);
        return;
      }

      const gameCopy = { ...game };
      const move = gameCopy.move({
        from: moveFrom,
        to: square,
        promotion: "q",
      });

      if (move === null) {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
        return;
      }

      setGame(gameCopy);
      setTimeout(makeStockfishMove, 500);
      setMoveFrom(null);
      setMoveTo(null);
      setOptionSquares({});
      return;
    }
  }

  function onPromotionPieceSelect(piece: any) {
    if (piece) {
      const gameCopy = { ...game };
      gameCopy.move({
        from: moveFrom!,
        to: moveTo!,
        promotion: piece[1].toLowerCase() ?? "q",
      });
      setGame(gameCopy);
      setTimeout(makeStockfishMove, 500);
    }

    setMoveFrom(null);
    setMoveTo(null);
    setShowPromotionDialog(false);
    setOptionSquares({});
    return true;
  }

  function onSquareRightClick(square: Square) {
    const colour = "rgba(255, 0, 0, 0.5)";
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] &&
        rightClickedSquares[square]!.backgroundColor === colour
          ? undefined
          : { backgroundColor: colour },
    });
  }

  const onNewGame = useCallback(() => {
    game.reset();
    useBoardStore.setState({ moves: [] });
    setGameResult(""); // إعادة تعيين نتيجة اللعبة
    setShowGameModal(false); // إغلاق المودال
    setGameOver(false); // إعادة تعيين حالة انتهاء اللعبة
    if (playAs === "black") {
      makeStockfishMove();
    }
  }, [game, playAs, makeStockfishMove, setGameResult, setGameOver]); // أضف setGameResult و setGameOver كاعتمادات

  useEffect(() => {
    setOnNewGame(onNewGame);

    return () => {
      setOnNewGame(() => {});
    };
  }, [onNewGame, setOnNewGame]);

  // *** التعديل الرئيسي هنا: استخدام ResizeObserver ***
  useEffect(() => {
    if (!chessboardContainerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // نأخذ أصغر قيمة بين العرض والارتفاع لضمان أن يكون لوح الشطرنج مربعًا
        const newSize = Math.min(entry.contentRect.width, entry.contentRect.height);
        // يمكنك إضافة حد أدنى أو أقصى هنا إذا كنت تريد
        setBoardWidth(newSize);
      }
    });

    resizeObserver.observe(chessboardContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // تشغيل مرة واحدة عند التحميل

  useEffect(() => {
    useBoardStore.setState({ currentFEN: game.fen() });
  }, [game]);

  return (
    // نلف Chessboard في div جديد نستخدمه للمراقبة
    <div ref={chessboardContainerRef} className="w-full h-full flex justify-center items-center">
      <Chessboard
        animationDuration={300}
        arePiecesDraggable={false}
        boardOrientation={playAs as BoardOrientation}
        position={game.fen()}
        boardWidth={boardWidth} // الآن boardWidth سيتحدث ديناميكيًا بناءً على حجم الـ div الحاوي
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        onPromotionPieceSelect={onPromotionPieceSelect}
        customBoardStyle={{
          borderRadius: "4px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
        }}
        customSquareStyles={{
          ...moveSquares,
          ...optionSquares,
          ...rightClickedSquares,
        }}
        promotionToSquare={moveTo}
        showPromotionDialog={showPromotionDialog}
        customDarkSquareStyle={convertCSSPropertiesToStringObject(
          theme.darkSquareStyle
        )}
        customLightSquareStyle={convertCSSPropertiesToStringObject(
          theme.lightSquareStyle
        )}
      />
      <GameModal
        isOpen={showGameModal}
        onClose={() => setShowGameModal(false)}
        gameResult={gameResult}
        onNewGame={onNewGame}
      />
    </div>
  );
};

export default ChessboardBot;