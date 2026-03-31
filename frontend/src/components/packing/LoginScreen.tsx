'use client';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-[100svh] flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-gray-100 dark:border-gray-700 transition-all">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 dark:bg-indigo-500 w-16 h-16 rounded-[1.25rem] mx-auto flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/30">
            <span className="text-3xl">📦</span>
          </div>
          <h1 className="text-3xl font-[900] text-gray-900 dark:text-white mb-2 tracking-tight">OMS LOGIN</h1>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">READY TO PACK ORDERS?</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem('customName') as HTMLInputElement).value;
            if (input) onLogin(input);
          }}
          className="flex flex-col gap-4"
        >
          <input
            name="customName"
            placeholder="YOUR NAME"
            autoFocus
            className="w-full bg-gray-100 dark:bg-gray-700/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-4 py-4 text-center text-lg font-black dark:text-white outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
          <button className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-indigo-500/20 active:scale-[0.96] transition-all">
            LOGIN 🚀
          </button>
        </form>
      </div>
    </div>
  );
}
