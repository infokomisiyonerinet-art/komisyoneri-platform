<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<script>
  // Iyi ni ya kode yawe wanyeretse, ariko yanditse neza ngo ikore muri Browser
  const firebaseConfig = {
    apiKey: "AIzaSyAtNnbsXKFgABvP-nTvGwz6pooGnSWSshY",
    authDomain: "komisiyoneri-78e82.firebaseapp.com",
    projectId: "komisiyoneri-78e82",
    storageBucket: "komisiyoneri-78e82.firebasestorage.app",
    messagingSenderId: "580559336922",
    appId: "1:580559336922:web:2275a3013b07cf56c0fce3",
    measurementId: "G-NE0PHMB885"
  };

  // Tangiza Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Tangiza Database na Storage (Ibi ni ingenzi cyane)
const db = firebase.firestore()
const rtdb = firebase.database();
</script>