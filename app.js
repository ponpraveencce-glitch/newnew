// -------------------------------------------------------------
// SecurCert - Frontend Application Logic & Local Blockchain Simulation
// -------------------------------------------------------------
// LocalStorage Database Keys
const DB_CERTS_KEY = 'securcert_registry_certs';
const DB_LEDGER_KEY = 'securcert_registry_ledger';
const WALLET_KEY = 'securcert_wallet_address';
// Global State
let dbCerts = [];
let dbLedger = [];
let connectedWallet = null;
let currentTab = 'verify';
let currentVerifyTab = 'file-upload';
let activeIssuedCert = null; // Stores currently generated cert details for PDF generation
// Default Mock Data if registry is empty
const MOCK_ISSUER_CONTRACT = '0x82C7fF21132e0Db9d4791Fa2924376Ac172F1A3b';
// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadDatabase();
    initNavigation();
    initWallet();
    initVerifyTabs();
    initDragAndDrop();
    initFormHandlers();
    initCollapsible();
    updateLedgerStats();
    renderLedgerExplorer();
});
// -------------------------------------------------------------
// 1. Database & State Management
// -------------------------------------------------------------
function loadDatabase() {
    const certsRaw = localStorage.getItem(DB_CERTS_KEY);
    const ledgerRaw = localStorage.getItem(DB_LEDGER_KEY);
    connectedWallet = localStorage.getItem(WALLET_KEY);
    if (certsRaw) {
        dbCerts = JSON.parse(certsRaw);
    } else {
        // Seed database with a sample certificate for PONVEL S
        const sampleCert = {
            certificateId: 'CERT-2026-4829',
            studentName: 'Ponvel S',
            registerNumber: '21CS094',
            department: 'Computer Science',
            course: 'Blockchain & Smart Contract Engineering',
            grade: 'A+',
            institution: 'SecurCert Academy',
            completionDate: '2026-07-15',
            issueDate: '2026-07-16',
            authority: 'Program Coordinator',
            certificateHash: '4a0f44bd1337b587a8b41ee33e8b4bb6840742f9e4e6d328328120ee4cf57fbd',
            blockchainTxHash: '0x32f1837dbe1b2c457199cd68cbbe62cfa02237eb8971fce88bc277bf8238c92a',
            blockHeight: 48290,
            timestamp: '2026-07-16 11:24:15',
            issuerWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        };
        dbCerts.push(sampleCert);
        localStorage.setItem(DB_CERTS_KEY, JSON.stringify(dbCerts));
    }
    if (ledgerRaw) {
        dbLedger = JSON.parse(ledgerRaw);
    } else {
        // Seed ledger table matches the sample cert
        const sampleBlock = {
            blockHeight: 48290,
            timestamp: '2026-07-16 11:24:15',
            blockchainTxHash: '0x32f1837dbe1b2c457199cd68cbbe62cfa02237eb8971fce88bc277bf8238c92a',
            certificateId: 'CERT-2026-4829',
            certificateHash: '4a0f44bd1337b587a8b41ee33e8b4bb6840742f9e4e6d328328120ee4cf57fbd',
            issuerWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        };
        dbLedger.push(sampleBlock);
        localStorage.setItem(DB_LEDGER_KEY, JSON.stringify(dbLedger));
    }
}
// SHA-256 hash helper using browser native Web Crypto API
async function calculateSHA256(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// -------------------------------------------------------------
// 2. Navigation & UI Controls
// -------------------------------------------------------------
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            currentTab = targetTab;
            
            // Re-render Explorer when visiting it
            if (currentTab === 'explorer') {
                renderLedgerExplorer();
                updateLedgerStats();
            }
        });
    });
}
function initVerifyTabs() {
    const vTabButtons = document.querySelectorAll('.v-tab-btn');
    const vTabContents = document.querySelectorAll('.vtab-content');
    vTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetVTab = btn.getAttribute('data-vtab');
            
            vTabButtons.forEach(b => b.classList.remove('active'));
            vTabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`vtab-${targetVTab}`).classList.add('active');
            
            currentVerifyTab = targetVTab;
        });
    });
}
function initCollapsible() {
    const header = document.querySelector('.collapsible-header');
    const container = document.querySelector('.collapsible-section');
    if (header && container) {
        header.addEventListener('click', () => {
            container.classList.toggle('open');
        });
    }
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute('data-target');
            const textToCopy = document.getElementById(targetId).textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success)"></i>';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 1500);
            });
        });
    });
}
// -------------------------------------------------------------
// 3. Web3 / Wallet Connection Simulation
// -------------------------------------------------------------
function initWallet() {
    const walletBtn = document.getElementById('connect-wallet-btn');
    
    // Update button text on load
    if (connectedWallet) {
        setWalletConnectedUI(connectedWallet);
    }
    walletBtn.addEventListener('click', async () => {
        if (connectedWallet) {
            // Disconnect wallet
            connectedWallet = null;
            localStorage.removeItem(WALLET_KEY);
            walletBtn.classList.remove('connected');
            walletBtn.querySelector('span').textContent = 'Connect Wallet';
            walletBtn.querySelector('i').className = 'fa-solid fa-wallet';
        } else {
            // Connect simulation
            walletBtn.querySelector('span').textContent = 'Connecting...';
            
            // Check if actual MetaMask exists
            if (window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    connectedWallet = accounts[0];
                    localStorage.setItem(WALLET_KEY, connectedWallet);
                    setWalletConnectedUI(connectedWallet);
                } catch (err) {
                    console.error('Wallet connection declined, using simulated address.', err);
                    simulateWalletConnection();
                }
            } else {
                setTimeout(() => {
                    simulateWalletConnection();
                }, 800);
            }
        }
    });
}
function simulateWalletConnection() {
    connectedWallet = '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
    localStorage.setItem(WALLET_KEY, connectedWallet);
    setWalletConnectedUI(connectedWallet);
}
function setWalletConnectedUI(address) {
    const walletBtn = document.getElementById('connect-wallet-btn');
    const truncatedAddress = address.slice(0, 6) + '...' + address.slice(-4);
    walletBtn.classList.add('connected');
    walletBtn.querySelector('span').textContent = truncatedAddress;
    walletBtn.querySelector('i').className = 'fa-solid fa-link';
}
// -------------------------------------------------------------
// 4. Drag & Drop File Verification API
// -------------------------------------------------------------
function initDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('cert-file-input');
    const infoBar = document.getElementById('file-info-bar');
    const nameLabel = document.getElementById('file-name-label');
    const clearBtn = document.getElementById('clear-file-btn');
    // Drag-over hover effects
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });
    // Drop file action
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            handleSelectedFile(files[0]);
        }
    });
    // Browse file click
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleSelectedFile(fileInput.files[0]);
        }
    });
    clearBtn.addEventListener('click', () => {
        fileInput.value = '';
        infoBar.style.display = 'none';
        dropZone.style.display = 'block';
        resetVerificationResults();
    });
}
let loadedFileBuffer = null;
function handleSelectedFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Invalid file format. Please upload a PDF certificate.');
        return;
    }
    const dropZone = document.getElementById('drop-zone');
    const infoBar = document.getElementById('file-info-bar');
    const nameLabel = document.getElementById('file-name-label');
    nameLabel.textContent = file.name;
    dropZone.style.display = 'none';
    infoBar.style.display = 'flex';
    // Read file arraybuffer
    const reader = new FileReader();
    reader.onload = function(e) {
        loadedFileBuffer = e.target.result;
    };
    reader.readAsArrayBuffer(file);
}
// -------------------------------------------------------------
// 5. Verification Logic (Queries Ledger)
// -------------------------------------------------------------
async function performVerification() {
    const placeholder = document.getElementById('result-placeholder');
    const loader = document.getElementById('result-loader');
    const successBox = document.getElementById('result-success');
    const errorBox = document.getElementById('result-error');
    // Show loading spinner
    placeholder.style.display = 'none';
    successBox.style.display = 'none';
    errorBox.style.display = 'none';
    loader.style.display = 'block';
    // Simulate Network Latency
    setTimeout(async () => {
        loader.style.display = 'none';
        if (currentVerifyTab === 'file-upload') {
            if (!loadedFileBuffer) {
                showVerificationError('No certificate file uploaded. Please drag a PDF file first.');
                return;
            }
            await verifyPdfData(loadedFileBuffer);
        } else {
            // Manual hash or ID verify
            const manualId = document.getElementById('manual-cert-id').value.trim();
            const manualHash = document.getElementById('manual-cert-hash').value.trim();
            if (!manualId && !manualHash) {
                showVerificationError('Please enter a Certificate ID or SHA-256 Hash value.');
                return;
            }
            let foundCert = null;
            if (manualId) {
                foundCert = dbCerts.find(c => c.certificateId.toLowerCase() === manualId.toLowerCase());
            } else if (manualHash) {
                foundCert = dbCerts.find(c => c.certificateHash.toLowerCase() === manualHash.toLowerCase());
            }
            if (foundCert) {
                showVerificationSuccess(foundCert);
            } else {
                showVerificationError(`No matching ledger found on blockchain registry for "${manualId || manualHash.substring(0, 16)}..."`);
            }
        }
    }, 1200);
}
async function verifyPdfData(arrayBuffer) {
    try {
        // Load pdf using PDF-lib
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const keywords = pdfDoc.getKeywords();
        
        if (!keywords) {
            showVerificationError('Verification failed. This PDF does not contain cryptographic metadata signature block.');
            return;
        }
        // Keywords schema: [certificateId, studentName, course, grade, completionDate, signatureHash]
        const dataArr = keywords.split(',').map(s => s.trim());
        if (dataArr.length < 6) {
            showVerificationError('Tampered Certificate. Cryptographic signature metadata fields are malformed or missing.');
            return;
        }
        const [pdfCertId, pdfName, pdfCourse, pdfGrade, pdfDate, pdfHash] = dataArr;
        // Query database ledger using Extracted PDF Certificate ID
        const matchedLedger = dbCerts.find(c => c.certificateId.toLowerCase() === pdfCertId.toLowerCase());
        
        if (!matchedLedger) {
            showVerificationError(`Unrecognized Certificate ID: "${pdfCertId}". No matching record exists on the blockchain registry.`);
            return;
        }
        // Perform Cryptographic Hash Verification matching metadata
        const dataPayload = `${pdfCertId}|${matchedLedger.registerNumber}|${pdfName}|${matchedLedger.department}|${pdfCourse}|${matchedLedger.institution}|${pdfDate}|${matchedLedger.issueDate}|${pdfGrade}`;
        const calculatedHash = await calculateSHA256(dataPayload);
        // Verify if hashes match
        if (calculatedHash === matchedLedger.certificateHash && pdfHash === matchedLedger.certificateHash) {
            showVerificationSuccess(matchedLedger);
        } else {
            showVerificationError('CRITICAL WARNING: Tampering Detected! The cryptographic document contents do not match the immutable blockchain ledger hash.');
        }
    } catch (err) {
        console.error('PDF parsing error during verification:', err);
        showVerificationError('Error parsing certificate PDF. Ensure the file is not corrupted.');
    }
}
function showVerificationSuccess(cert) {
    document.getElementById('result-success').style.display = 'block';
    
    document.getElementById('res-cert-id').textContent = cert.certificateId;
    document.getElementById('res-student-name').textContent = cert.studentName;
    document.getElementById('res-course').textContent = cert.course;
    document.getElementById('res-grade').textContent = cert.grade;
    document.getElementById('res-date').textContent = cert.completionDate;
    document.getElementById('res-authority').textContent = `${cert.authority} • ${cert.institution}`;
    
    document.getElementById('res-sha-hash').textContent = cert.certificateHash;
    document.getElementById('res-tx-hash').textContent = cert.blockchainTxHash;
    document.getElementById('res-block-info').textContent = `Block #${cert.blockHeight} • Registered on ${cert.timestamp}`;
}
function showVerificationError(message) {
    document.getElementById('result-error').style.display = 'block';
    document.getElementById('error-message-text').textContent = message;
}
function resetVerificationResults() {
    document.getElementById('result-placeholder').style.display = 'block';
    document.getElementById('result-loader').style.display = 'none';
    document.getElementById('result-success').style.display = 'none';
    document.getElementById('result-error').style.display = 'none';
}
// -------------------------------------------------------------
// 6. Issuance & Signing Portal Logic
// -------------------------------------------------------------
async function handleCertificateIssuance(e) {
    e.preventDefault();
    const name = document.getElementById('student-name').value.trim();
    const regNo = document.getElementById('register-number').value.trim();
    const inst = document.getElementById('institution').value.trim();
    const dept = document.getElementById('department').value.trim();
    const course = document.getElementById('course-title').value.trim();
    const grade = document.getElementById('grade-value').value;
    const date = document.getElementById('completion-date').value;
    const auth = document.getElementById('issuance-authority').value.trim();
    // 1. Generate unique Cert ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const year = new Date(date).getFullYear() || new Date().getFullYear();
    const certId = `CERT-${year}-${randomSuffix}`;
    // 2. Hash construction
    const issueDateStr = new Date().toISOString().split('T')[0];
    const dataPayload = `${certId}|${regNo}|${name}|${dept}|${course}|${inst}|${date}|${issueDateStr}|${grade}`;
    const certHash = await calculateSHA256(dataPayload);
    // 3. Create simulated Blockchain Block Transaction
    const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const blockNum = dbLedger.length ? dbLedger[0].blockHeight + 1 : 48291;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const issuerAddress = connectedWallet || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Fallback admin wallet
    const newCert = {
        certificateId: certId,
        studentName: name,
        registerNumber: regNo,
        department: dept,
        course: course,
        grade: grade,
        institution: inst,
        completionDate: date,
        issueDate: issueDateStr,
        authority: auth,
        certificateHash: certHash,
        blockchainTxHash: txHash,
        blockHeight: blockNum,
        timestamp: timestampStr,
        issuerWallet: issuerAddress
    };
    // Save to Local DB State
    dbCerts.unshift(newCert);
    localStorage.setItem(DB_CERTS_KEY, JSON.stringify(dbCerts));
    // Save block to Ledger Table
    const newBlock = {
        blockHeight: blockNum,
        timestamp: timestampStr,
        blockchainTxHash: txHash,
        certificateId: certId,
        certificateHash: certHash,
        issuerWallet: issuerAddress
    };
    dbLedger.unshift(newBlock);
    localStorage.setItem(DB_LEDGER_KEY, JSON.stringify(dbLedger));
    // Store active certificate globally for PDF rendering trigger
    activeIssuedCert = newCert;
    // 4. Update UI Preview Content
    document.getElementById('mock-preview-inst').textContent = inst.toUpperCase();
    document.getElementById('mock-preview-name').textContent = name;
    document.getElementById('mock-preview-course').textContent = course;
    document.getElementById('mock-preview-grade').textContent = grade;
    document.getElementById('mock-preview-date').textContent = date;
    // Generate Verification URL for QR code
    // Points to current window path or general verify lookup
    const qrTargetUrl = `${window.location.origin}${window.location.pathname}?verifyId=${certId}`;
    
    // Clear old QR code
    const qrContainer = document.getElementById('preview-qr-code');
    qrContainer.innerHTML = '';
    
    // Render dynamic QR code in preview panel
    new QRCode(qrContainer, {
        text: qrTargetUrl,
        width: 80,
        height: 80,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    // Toggle Preview display states
    document.getElementById('preview-placeholder').style.display = 'none';
    document.getElementById('preview-success').style.display = 'block';
    // Clear form inputs
    document.getElementById('issue-form').reset();
    // Sync Stats
    updateLedgerStats();
}
// -------------------------------------------------------------
// 7. Client-Side PDF Generation & Downloads via PDF-Lib
// -------------------------------------------------------------
async function generateAndDownloadPDF() {
    if (!activeIssuedCert) return;
    try {
        const cert = activeIssuedCert;
        // 1. Create a new PDF document using PDF-Lib
        const pdfDoc = await PDFLib.PDFDocument.create();
        const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape size (in points)
        const { width, height } = page.getSize();
        // Load standard Helvetica fonts
        const fontTitle = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontOblique = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
        // 2. Draw border decorations
        // Draw primary slate border frame
        page.drawRectangle({
            x: 20,
            y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: PDFLib.rgb(0.06, 0.09, 0.16), // Dark slate
            borderWidth: 3,
            color: PDFLib.rgb(1, 1, 1) // White base certificate
        });
        // Draw inner gold outline
        page.drawRectangle({
            x: 25,
            y: 25,
            width: width - 50,
            height: height - 50,
            borderColor: PDFLib.rgb(0.85, 0.47, 0.02), // Gold
            borderWidth: 1
        });
        // 3. Draw text certificate contents
        // Institution Header
        const instText = cert.institution.toUpperCase();
        const instWidth = fontTitle.widthOfTextAtSize(instText, 24);
        page.drawText(instText, {
            x: (width - instWidth) / 2,
            y: height - 80,
            size: 24,
            font: fontTitle,
            color: PDFLib.rgb(0.06, 0.09, 0.16)
        });
        // Department Subheader
        const deptText = `DEPARTMENT OF ${cert.department.toUpperCase()}`;
        const deptWidth = fontRegular.widthOfTextAtSize(deptText, 12);
        page.drawText(deptText, {
            x: (width - deptWidth) / 2,
            y: height - 105,
            size: 12,
            font: fontRegular,
            color: PDFLib.rgb(0.3, 0.35, 0.4)
        });
        // Main certificate subtitle
        const certSub = "CERTIFICATE OF COMPLETION";
        const subWidth = fontTitle.widthOfTextAtSize(certSub, 16);
        page.drawText(certSub, {
            x: (width - subWidth) / 2,
            y: height - 160,
            size: 16,
            font: fontTitle,
            color: PDFLib.rgb(0.15, 0.39, 0.92) // Royal Blue accent
        });
        // Certify descriptor
        const certifyText = "This is to certify that";
        const certifyWidth = fontOblique.widthOfTextAtSize(certifyText, 14);
        page.drawText(certifyText, {
            x: (width - certifyWidth) / 2,
            y: height - 200,
            size: 14,
            font: fontOblique,
            color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        // Student Name
        const nameText = cert.studentName;
        const nameWidth = fontTitle.widthOfTextAtSize(nameText, 28);
        page.drawText(nameText, {
            x: (width - nameWidth) / 2,
            y: height - 250,
            size: 28,
            font: fontTitle,
            color: PDFLib.rgb(0.06, 0.09, 0.16)
        });
        
        // Draw underline below Student Name
        page.drawLine({
            start: { x: (width - nameWidth) / 2 - 10, y: height - 258 },
            end: { x: (width - nameWidth) / 2 + nameWidth + 10, y: height - 258 },
            thickness: 2,
            color: PDFLib.rgb(0.06, 0.09, 0.16)
        });
        // Register Number
        const regText = `Register Number: ${cert.registerNumber}`;
        const regWidth = fontRegular.widthOfTextAtSize(regText, 12);
        page.drawText(regText, {
            x: (width - regWidth) / 2,
            y: height - 280,
            size: 12,
            font: fontRegular,
            color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        // Course completion summary
        const courseText = `has successfully completed the course program`;
        const courseWidth = fontRegular.widthOfTextAtSize(courseText, 14);
        page.drawText(courseText, {
            x: (width - courseWidth) / 2,
            y: height - 320,
            size: 14,
            font: fontRegular,
            color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        // Course Title
        const titleText = cert.course;
        const titleWidth = fontTitle.widthOfTextAtSize(titleText, 18);
        page.drawText(titleText, {
            x: (width - titleWidth) / 2,
            y: height - 350,
            size: 18,
            font: fontTitle,
            color: PDFLib.rgb(0.06, 0.09, 0.16)
        });
        // Academic details
        const detailsText = `held up to ${cert.completionDate} and secured Grade ${cert.grade}`;
        const detailsWidth = fontRegular.widthOfTextAtSize(detailsText, 13);
        page.drawText(detailsText, {
            x: (width - detailsWidth) / 2,
            y: height - 380,
            size: 13,
            font: fontRegular,
            color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        // Coordinators line
        page.drawLine({
            start: { x: 80, y: 110 },
            end: { x: 260, y: 110 },
            thickness: 1,
            color: PDFLib.rgb(0.6, 0.6, 0.6)
        });
        page.drawText(cert.authority.toUpperCase(), {
            x: 80,
            y: 92,
            size: 9,
            font: fontTitle,
            color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        page.drawText('ISSUING REPRESENTATIVE SIGNATURE', {
            x: 80,
            y: 80,
            size: 8,
            font: fontRegular,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        // 4. Embed QR Code Image
        // Get canvas generated by QRCodeJS
        const qrCanvas = document.getElementById('preview-qr-code').querySelector('canvas');
        if (qrCanvas) {
            const qrDataUrl = qrCanvas.toDataURL('image/png');
            const qrImage = await pdfDoc.embedPng(qrDataUrl);
            
            // Draw QR code image on right bottom corner
            page.drawImage(qrImage, {
                x: width - 180,
                y: 75,
                width: 90,
                height: 90
            });
        }
        // QR verification labels
        page.drawText(`Certificate ID: ${cert.certificateId}`, {
            x: width - 210,
            y: 60,
            size: 8,
            font: fontTitle,
            color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        page.drawText(`Verify authenticity at SecurCert portal`, {
            x: width - 210,
            y: 50,
            size: 7,
            font: fontRegular,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        // 5. Inject Cryptographic metadata into PDF properties
        // This is critical, it allows client-side parsing and verification!
        // Format keywords: certificateId, studentName, course, grade, completionDate, signatureHash
        const metaKeywords = `${cert.certificateId}, ${cert.studentName}, ${cert.course}, ${cert.grade}, ${cert.completionDate}, ${cert.certificateHash}`;
        pdfDoc.setKeywords([metaKeywords]);
        pdfDoc.setProducer('SecurCert Decentralized Proof Engine v1.0');
        pdfDoc.setTitle(`Academic Certificate - ${cert.studentName}`);
        // 6. Serialize and Trigger browser save download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `securcert-${cert.certificateId}.pdf`;
        link.click();
        
        // Clean URL ref
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    } catch (err) {
        console.error('PDF generation failure:', err);
        alert('Failed to generate PDF document. See developer console for logs.');
    }
}
// -------------------------------------------------------------
// 8. Blockchain Explorer Views & Stats rendering
// -------------------------------------------------------------
function updateLedgerStats() {
    document.getElementById('explorer-total-certs').textContent = dbCerts.length;
    
    const blockHeight = dbLedger.length ? dbLedger[0].blockHeight : 48290;
    document.getElementById('explorer-block-height').textContent = `#${blockHeight}`;
}
function renderLedgerExplorer() {
    const tableBody = document.getElementById('explorer-table-body');
    tableBody.innerHTML = '';
    if (!dbLedger.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">No block transactions found. Issue a certificate to register data on the chain.</td>
            </tr>`;
        return;
    }
    dbLedger.forEach(block => {
        const tr = document.createElement('tr');
        
        // Truncate hashes for clean visual display
        const truncTx = block.blockchainTxHash.substring(0, 10) + '...' + block.blockchainTxHash.slice(-6);
        const truncProof = block.certificateHash.substring(0, 16) + '...';
        const truncWallet = block.issuerWallet.substring(0, 8) + '...' + block.issuerWallet.slice(-4);
        tr.innerHTML = `
            <td><span class="block-num">#${block.blockHeight}</span></td>
            <td>${block.timestamp}</td>
            <td><a href="#" class="tx-hash-link" title="${block.blockchainTxHash}">${truncTx}</a></td>
            <td><span class="highlight" style="font-family: monospace; font-weight:600;">${block.certificateId}</span></td>
            <td><span class="proof-hash" title="${block.certificateHash}">${truncProof}</span></td>
            <td><span class="wallet-addr" title="${block.issuerWallet}" style="font-family: monospace;">${truncWallet}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}
function handleLedgerReset() {
    if (confirm('Are you sure you want to purge all certificates from the simulated local blockchain? This will delete all user-added certificates.')) {
        localStorage.removeItem(DB_CERTS_KEY);
        localStorage.removeItem(DB_LEDGER_KEY);
        dbCerts = [];
        dbLedger = [];
        loadDatabase();
        updateLedgerStats();
        renderLedgerExplorer();
        resetVerificationResults();
        
        // Return preview back to default placeholder
        document.getElementById('preview-success').style.display = 'none';
        document.getElementById('preview-placeholder').style.display = 'flex';
        activeIssuedCert = null;
    }
}
// -------------------------------------------------------------
// 9. Attach Form Handlers & Query Params Action
// -------------------------------------------------------------
function initFormHandlers() {
    // Verify Submit Query Click
    document.getElementById('verify-submit-btn').addEventListener('click', performVerification);
    // Issue New Form Submit
    document.getElementById('issue-form').addEventListener('submit', handleCertificateIssuance);
    // PDF Download Button
    document.getElementById('download-pdf-btn').addEventListener('click', generateAndDownloadPDF);
    // Purge simulated chain records
    document.getElementById('clear-ledger-btn').addEventListener('click', handleLedgerReset);
    // Test Verify shortcut button on Issue Preview
    document.getElementById('direct-verify-btn').addEventListener('click', () => {
        if (!activeIssuedCert) return;
        // Switch back to Verify Tab
        document.querySelector('[data-tab="verify"]').click();
        
        // Switch subtab to manual search ID
        document.querySelector('[data-vtab="manual-hash"]').click();
        // Fill Search input details
        document.getElementById('manual-cert-id').value = activeIssuedCert.certificateId;
        document.getElementById('manual-cert-hash').value = '';
        // Trigger verify query
        performVerification();
    });
    // Check if query param exists in url e.g. ?verifyId=CERT-2026-4829
    const urlParams = new URLSearchParams(window.location.search);
    const verifyIdParam = urlParams.get('verifyId');
    if (verifyIdParam) {
        // Direct route verify
        document.querySelector('[data-tab="verify"]').click();
        document.querySelector('[data-vtab="manual-hash"]').click();
        document.getElementById('manual-cert-id').value = verifyIdParam;
        performVerification();
    }
}
