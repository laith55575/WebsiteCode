"use client";
import { useState } from "react";
import { ChessboardBot, SideBoardComponent } from "@/components";
import Image from "next/image";
import * as FlagIcons from "country-flag-icons/react/3x2";
import { Message } from "@/public/utils/types";
import { useSearchParams } from "next/navigation";
import { useBoardStore } from "../store";

const AgainstComputer: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const searchParams = useSearchParams();
  const stockfishLevel = Number(searchParams.get("stockfishLevel"));
  const stockfishLevelSymbol =
    stockfishLevel === 2 ? "E" : stockfishLevel === 6 ? "M" : "H";
  const { userName, profilePhoto } = useBoardStore((state) => ({
    userName: state.userName,
    profilePhoto: state.profilePhoto,
  }));
  const handleSendMessage = (message: string) => {
    if (message.trim() !== "") {
      const newMessage: Message = {
        username: userName,
        content: message,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    }
  };

  return (
    // العنصر الأب: flex-col على الشاشات الصغيرة، flex-row على الكبيرة
    // h-screen لضمان أن تأخذ الصفحة ارتفاع الشاشة بالكامل
    <div className="h-screen bg-gray-800 text-white flex flex-col sm:flex-row gap-4 sm:gap-8 sm:px-6 px-4 py-2">

      {/* Chessboard Container */}
      {/* على الشاشات الصغيرة: يأخذ 80% من الارتفاع (h-4/5) ويملأ العرض (w-full) */}
      {/* sm:flex-grow-[4] يضمن حصة أكبر من المساحة على الشاشات الكبيرة */}
      <div className="flex flex-col items-center justify-center gap-2 w-full h-4/5 sm:h-full sm:flex-grow-[4] sm:justify-center">
        <div className="flex justify-start w-full py-1 gap-1">
          <Image
            src="/images/def_stock.jpeg"
            width={40}
            height={40}
            alt="Bot Profile"
            className="rounded-md"
          />
          <div className="flex items-start justify-center gap-1 font-semibold">
            StockFish
            <span className="text-gray-300 font-light">
              ({stockfishLevelSymbol})
            </span>
            <span>
              <FlagIcons.US className="w-4 h-4 mx-1 mt-1" />
            </span>
          </div>
        </div>
        <ChessboardBot /> {/* ChessboardBot سيتوسع ليملأ الـ div الحاوي عليه */}
        <div className="flex justify-start w-full gap-1">
          <Image
            src={profilePhoto}
            width={40}
            height={40}
            alt="User Profile"
            className="rounded-md"
          />
          <div className="flex items-start justify-center gap-1 font-semibold">
            {userName}
            <span>
              <FlagIcons.IN className="w-4 h-4 mx-1 mt-1" />
            </span>
          </div>
        </div>
      </div>

      {/* SideBoard - حقل الدردشة */}
      {/* على الشاشات الصغيرة: يأخذ 20% من الارتفاع (h-1/5) ويسمح بالتمرير (overflow-auto) */}
      {/* sm:w-96 وعرض ثابت على الشاشات الكبيرة */}
      <div className="w-full h-1/5 sm:h-full sm:w-96 sm:flex-shrink-0 overflow-auto">
        <SideBoardComponent
          onSendMessage={handleSendMessage}
          messages={messages}
        />
      </div>
    </div>
  );
};

export default AgainstComputer;