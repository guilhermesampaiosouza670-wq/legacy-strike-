LEGACY STRIKE - SERVIDOR MULTIPLAYER

REQUISITOS
- Node.js 18 ou superior
- Acesso à internet (para jogar fora da mesma rede)

RODAR NO COMPUTADOR
1. Abra um terminal dentro desta pasta servidor_multiplayer.
2. Execute: npm install
3. Execute: npm start
4. O servidor inicia na porta 8080 (ou na porta definida pela hospedagem).

TESTE NA MESMA REDE WI-FI
- Descubra o IP local do computador que está rodando o servidor.
- No jogo, Multiplayer > Endereço do servidor, informe IP:8080.
  Exemplo: 192.168.1.50:8080
- Em todos os celulares/PCs, use o mesmo endereço.
- O primeiro jogador deixa o código da sala vazio e toca Criar / Entrar.
- Os outros digitam o código mostrado e tocam Criar / Entrar.
- O anfitrião toca Iniciar partida.

JOGAR PELA INTERNET
- Publique esta pasta em uma hospedagem que aceite aplicações Node.js e WebSocket.
- Configure a variável PORT se a hospedagem fornecer uma porta.
- No campo Endereço do servidor, use o domínio/host fornecido pela hospedagem.
  Em páginas HTTPS, o jogo agora usa wss:// automaticamente para endereços sem protocolo.
- Não use localhost para amigos que estão em outros aparelhos.

OBSERVAÇÕES
- O servidor retransmite posições, tiros, dano e mortes; ele não hospeda os arquivos do jogo.
- O servidor é um protótipo funcional para partidas privadas. Ainda não tem contas,
  persistência, anti-cheat robusto ou proteção avançada contra abuso.
