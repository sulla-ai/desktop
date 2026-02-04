<template>
  <!-- Agent Sidebar Examples - Three different personality styles -->
  <!-- Use these examples to choose which agent design you prefer -->

  <!-- EXAMPLE 1: THE MINIMALIST TERMINAL AGENT -->
  <!-- Clean, stark, retro-terminal aesthetic -->
  <div class="w-full p-3 relative">
    <!-- Glow effects -->
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-emerald-300 via-emerald-300/60 to-lime-300 opacity-10 blur-lg"></div>
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-emerald-300 via-emerald-300/60 to-lime-300 opacity-10"></div>
    <!-- Card container -->
    <div class="relative rounded-2xl bg-slate-900/90 ring-1 ring-white/10 backdrop-blur-sm overflow-hidden">
      <!-- Top accent line -->
      <div class="absolute -top-px right-11 left-20 h-px bg-gradient-to-r from-emerald-300/0 via-emerald-300/70 to-emerald-300/0"></div>
      <!-- Bottom accent line -->
      <div class="absolute right-20 -bottom-px left-11 h-px bg-gradient-to-r from-lime-300/0 via-lime-300/70 to-lime-300/0"></div>
      <!-- Window dots -->
      <div class="pt-3 pl-3 flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <!-- Agent Header -->
      <div class="flex items-center gap-3 p-4 pt-2">
        <!-- Avatar: Simple geometric face -->
        <div class="w-10 h-10 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center">
          <svg viewBox="0 0 40 40" class="w-8 h-8">
            <rect x="8" y="8" width="24" height="24" fill="none" stroke="#22c55e" stroke-width="2" />
            <rect x="12" y="16" width="6" height="2" fill="#22c55e" />
            <rect x="22" y="16" width="6" height="2" fill="#22c55e" />
            <rect x="14" y="26" width="12" height="1" fill="#22c55e" />
            <rect x="16" y="28" width="8" height="1" fill="#22c55e" class="animate-pulse" />
          </svg>
        </div>
        <div class="flex-1">
          <div class="text-[10px] text-emerald-300/80 uppercase tracking-wider font-mono">AGENT_ID</div>
          <div class="text-sm font-mono text-emerald-100">UNIT_01</div>
        </div>
        <!-- Status: Blinking terminal cursor -->
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-400 font-mono">ONLINE</span>
          <div class="w-2 h-3 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] animate-pulse"></div>
        </div>
      </div>
      <!-- Activity Log -->
      <div class="px-4 pb-4 font-mono text-xs">
        <div class="text-slate-500">> processing_task</div>
        <div class="text-emerald-300/70">> analyzing_data...</div>
        <div class="text-slate-600 mt-1">-- scanning --</div>
      </div>
    </div>
  </div>

  <!-- EXAMPLE 2: THE INDUSTRIAL WORKHORSE -->
  <!-- Heavy machinery, factory-floor vibe -->
  <div class="w-full p-3 relative">
    <!-- Glow effects -->
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-300 via-orange-300/60 to-yellow-300 opacity-10 blur-lg"></div>
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-300 via-orange-300/60 to-yellow-300 opacity-10"></div>
    <!-- Card container -->
    <div class="relative rounded-2xl bg-slate-900/90 ring-1 ring-white/10 backdrop-blur-sm overflow-hidden">
      <!-- Top accent line -->
      <div class="absolute -top-px right-11 left-20 h-px bg-gradient-to-r from-amber-300/0 via-amber-300/70 to-amber-300/0"></div>
      <!-- Bottom accent line -->
      <div class="absolute right-20 -bottom-px left-11 h-px bg-gradient-to-r from-yellow-300/0 via-yellow-300/70 to-yellow-300/0"></div>
      <!-- Window dots -->
      <div class="pt-3 pl-3 flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <!-- Agent Header -->
      <div class="flex items-center gap-3 p-4 pt-2">
        <!-- Avatar: Gear/robot hybrid -->
        <div class="w-12 h-12 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center relative overflow-hidden">
          <svg viewBox="0 0 48 48" class="w-10 h-10 animate-spin" style="animation-duration: 8s;">
            <circle cx="24" cy="24" r="6" fill="#f59e0b" />
            <path d="M24 8 L26 14 L24 12 L22 14 Z" fill="#f59e0b" />
            <path d="M24 40 L26 34 L24 36 L22 34 Z" fill="#f59e0b" />
            <path d="M8 24 L14 26 L12 24 L14 22 Z" fill="#f59e0b" />
            <path d="M40 24 L34 26 L36 24 L34 22 Z" fill="#f59e0b" />
          </svg>
          <div class="absolute w-3 h-3 bg-amber-400"></div>
        </div>
        <div class="flex-1">
          <div class="text-[10px] text-amber-300/80 uppercase tracking-wider font-mono">WORKER BOT</div>
          <div class="text-sm font-bold text-amber-100">GRINDER_v2</div>
        </div>
        <!-- Status: Hydraulic pressure gauge -->
        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-1">
            <div class="w-10 h-2 bg-slate-700/60 overflow-hidden ring-1 ring-white/5">
              <div class="h-full w-3/4 bg-gradient-to-r from-amber-600 to-amber-400 animate-pulse"></div>
            </div>
          </div>
          <span class="text-[10px] font-bold text-amber-300">ACTIVE</span>
        </div>
      </div>
      <!-- Status Panel -->
      <div class="px-4 pb-4">
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-slate-800/50 ring-1 ring-white/5 p-2">
            <div class="text-[10px] text-slate-400 uppercase">Torque</div>
            <div class="text-sm font-bold text-amber-200">84%</div>
          </div>
          <div class="bg-slate-800/50 ring-1 ring-white/5 p-2">
            <div class="text-[10px] text-slate-400 uppercase">Temp</div>
            <div class="text-sm font-bold text-amber-200">212°F</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- EXAMPLE 3: THE BIO-SYNTHETIC ORGANISM -->
  <!-- Living, breathing, organic-meets-tech feel -->
  <div class="w-full p-3 relative">
    <!-- Glow effects -->
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-300 via-cyan-300/60 to-teal-300 opacity-10 blur-lg"></div>
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-300 via-cyan-300/60 to-teal-300 opacity-10"></div>
    <!-- Card container -->
    <div class="relative rounded-2xl bg-slate-900/90 ring-1 ring-white/10 backdrop-blur-sm overflow-hidden">
      <!-- Top accent line -->
      <div class="absolute -top-px right-11 left-20 h-px bg-gradient-to-r from-cyan-300/0 via-cyan-300/70 to-cyan-300/0"></div>
      <!-- Bottom accent line -->
      <div class="absolute right-20 -bottom-px left-11 h-px bg-gradient-to-r from-teal-300/0 via-teal-300/70 to-teal-300/0"></div>
      <!-- Window dots -->
      <div class="pt-3 pl-3 flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <!-- Agent Header -->
      <div class="flex items-center gap-3 p-4 pt-2">
        <!-- Avatar: Living cell/organism -->
        <div class="w-11 h-11 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center relative">
          <div class="absolute w-6 h-6 bg-cyan-500/40 rounded-full blur-sm animate-pulse"></div>
          <div class="absolute w-4 h-4 bg-cyan-400/60 rounded-full"></div>
          <div class="absolute w-2 h-2 bg-white rounded-full animate-ping"></div>
          <svg viewBox="0 0 44 44" class="absolute w-full h-full">
            <path d="M10 22 Q22 10 34 22" fill="none" stroke="#06b6d4" stroke-width="1" opacity="0.5">
              <animate attributeName="d" values="M10 22 Q22 10 34 22;M10 22 Q22 34 34 22;M10 22 Q22 10 34 22" dur="3s" repeatCount="indefinite" />
            </path>
            <path d="M10 28 Q22 16 34 28" fill="none" stroke="#06b6d4" stroke-width="1" opacity="0.3">
              <animate attributeName="d" values="M10 28 Q22 16 34 28;M10 28 Q22 40 34 28;M10 28 Q22 16 34 28" dur="4s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="text-[10px] text-cyan-300/80 uppercase tracking-widest">Synapse</div>
          <div class="text-sm font-medium text-cyan-100">CORTEX-7</div>
        </div>
        <!-- Status: Heartbeat pulse -->
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 40 20" class="w-10 h-5">
            <polyline
              points="0 10 8 10 12 4 16 16 20 10 28 10 32 6 36 14 40 10"
              fill="none"
              stroke="#06b6d4"
              stroke-width="1.5"
            >
              <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </polyline>
          </svg>
        </div>
      </div>
      <!-- Neural Activity -->
      <div class="px-4 pb-4 space-y-2">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></div>
          <span class="text-xs text-cyan-300/80">dendrite_firing</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-cyan-500/50 rounded-full"></div>
          <span class="text-xs text-slate-400">membrane_potential: -70mV</span>
        </div>
        <div class="h-px bg-gradient-to-r from-cyan-500/50 via-cyan-500/20 to-transparent"></div>
        <div class="text-[10px] text-slate-500 font-mono">consciousness_stream: active</div>
      </div>
    </div>
  </div>

  <!-- EXAMPLE 4: THE GLASS CORE -->
  <!-- Ethereal glassmorphism with sky/blue glow accents -->
  <div class="w-full p-3 relative">
    <!-- Glow effects -->
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10 blur-lg"></div>
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10"></div>
    <!-- Card container -->
    <div class="relative rounded-2xl bg-slate-900/90 ring-1 ring-white/10 backdrop-blur-sm overflow-hidden">
      <!-- Top accent line -->
      <div class="absolute -top-px right-11 left-20 h-px bg-gradient-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
      <!-- Bottom accent line -->
      <div class="absolute right-20 -bottom-px left-11 h-px bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>
      <!-- Window dots -->
      <div class="pt-3 pl-3 flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <!-- Agent Header -->
      <div class="flex items-center gap-3 p-4 pt-2">
      <!-- Avatar: Glowing core -->
      <div class="w-11 h-11 relative flex items-center justify-center">
        <div class="absolute inset-0 bg-sky-500/30 rounded-full blur-md animate-pulse"></div>
        <div class="absolute inset-1 bg-gradient-to-tr from-sky-400 to-blue-500 rounded-full opacity-80"></div>
        <div class="relative w-5 h-5 bg-white rounded-full shadow-[0_0_10px_rgba(56,189,248,0.8)]"></div>
      </div>
      <div class="flex-1">
        <div class="text-[10px] text-sky-300/80 uppercase tracking-wider font-mono">Core_ID</div>
        <div class="text-sm font-semibold text-sky-100">PRISM_04</div>
      </div>
      <!-- Status: Pulsing orb -->
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-slate-400 font-mono">LIVE</span>
        <div class="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,1)] animate-pulse"></div>
      </div>
    </div>
    <!-- Activity Panel -->
    <div class="px-4 pb-4 space-y-2">
      <!-- Process badges -->
      <div class="flex flex-wrap gap-1.5">
        <div class="flex h-5 rounded-full bg-gradient-to-r from-sky-400/20 via-sky-400/40 to-sky-400/20 p-px">
          <div class="flex items-center rounded-full px-2 text-[10px] font-medium text-sky-300 bg-slate-800/80">inference.js</div>
        </div>
        <div class="flex h-5 rounded-full bg-slate-700/30">
          <div class="flex items-center rounded-full px-2 text-[10px] text-slate-400">model.gguf</div>
        </div>
      </div>
      <!-- Metrics -->
      <div class="flex items-center gap-3 text-[10px] font-mono pt-1">
        <div class="flex items-center gap-1 text-slate-400">
          <span class="text-sky-400/60">tokens/s:</span>
          <span class="text-sky-200">847</span>
        </div>
        <div class="flex items-center gap-1 text-slate-400">
          <span class="text-blue-400/60">temp:</span>
          <span class="text-blue-200">0.7</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- CSS for the animations (add to your styles) -->
<style scoped>
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px currentColor; }
  50% { box-shadow: 0 0 12px currentColor; }
}

.animate-blink {
  animation: blink 1s ease-in-out infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
</style>
</template>
