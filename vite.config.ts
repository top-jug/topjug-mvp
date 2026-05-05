import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  // server: {
  //   allowedHosts: ['recollect-kilowatt-aim.ngrok-free.dev'],
  // },
  server: {
    // true로 설정하면 ngrok 주소가 매번 바뀌어도 모두 허용해 줍니다. (개발용으로 가장 편리함)
    allowedHosts: true, 
    
    // 만약 보안이 걱정되신다면 현재 발급받은 주소만 콕 집어서 허용할 수도 있습니다.
    // allowedHosts: ['suffocate-theater-macarena.ngrok-free.dev'],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
