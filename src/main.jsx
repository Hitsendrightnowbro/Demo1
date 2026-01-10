import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana } from '@reown/appkit/networks';
import './index.css';

const projectId = import.meta.env.VITE_PROJECT_ID;
const metadata = {
  name: 'ُSolana Airdrop',
  description: 'Claim your free Solana Airdrop!',
  url: 'https://102996b91469.ngrok-free.app/',
  icons: ['https://s3.coinmarketcap.com/static-gravity/image/5cc0b99a8dd84fbfa4e150d84b5531f2.png']
};

const solanaAdapter = new SolanaAdapter({
  projectId,
  networks: [solana]
});

const appKit = createAppKit({
  adapters: [solanaAdapter],
  networks: [solana],
  metadata,
  projectId,
  features: {
    analytics: true
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App appKit={appKit} />
  </React.StrictMode>
);