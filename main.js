const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const isDev = require('electron-is-dev');
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });

    // Determine the correct path for uploads
    const uploadsPath = isDev
        ? path.join(__dirname, 'uploads')
        : path.join(process.resourcesPath, 'uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
    }

    // Set up Express server
    const server = express();
    server.use(bodyParser.json());
    server.use(express.static(path.join(__dirname)));
    server.use('/uploads', express.static(uploadsPath));

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadsPath)
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname)
        }
    });
    const upload = multer({ storage: storage });

    const dataFile = isDev
        ? path.join(__dirname, 'data.json')
        : path.join(process.resourcesPath, 'data.json');

    // Load existing data or initialize empty array
    let documents = [];
    if (fs.existsSync(dataFile)) {
        const data = fs.readFileSync(dataFile, 'utf8');
        documents = JSON.parse(data);
    }

    function saveData() {
        fs.writeFileSync(dataFile, JSON.stringify(documents, null, 2));
    }

    function renumberDocuments() {
        documents.sort((a, b) => b.serialNumber - a.serialNumber);
        documents.forEach((doc, index) => {
            doc.serialNumber = documents.length - index;
        });
        saveData();
    }

    server.post('/api/documents', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'actionPdf', maxCount: 1 }]), (req, res) => {
        const newDoc = req.body;
        newDoc.serialNumber = documents.length > 0 ? Math.max(...documents.map(d => d.serialNumber)) + 1 : 1;
        newDoc.dateOfDocument = new Date().toISOString().split('T')[0];
        
        if (req.files.pdf) {
            newDoc.pdfPath = '/uploads/' + path.basename(req.files.pdf[0].path);
        }
        if (req.files.actionPdf) {
            newDoc.actionPdfPath = '/uploads/' + path.basename(req.files.actionPdf[0].path);
        }
        
        documents.unshift(newDoc);
        saveData();
        res.json({ message: 'Document added successfully', document: newDoc });
    });

    server.put('/api/documents/:id', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'actionPdf', maxCount: 1 }]), (req, res) => {
        const id = parseInt(req.params.id);
        const index = documents.findIndex(doc => doc.serialNumber === id);
        if (index !== -1) {
            const updatedDoc = { ...documents[index], ...req.body };
            
            if (req.files.pdf) {
                updatedDoc.pdfPath = '/uploads/' + path.basename(req.files.pdf[0].path);
            }
            if (req.files.actionPdf) {
                updatedDoc.actionPdfPath = '/uploads/' + path.basename(req.files.actionPdf[0].path);
            }
            
            documents[index] = updatedDoc;
            saveData();
            res.json({ message: 'Document updated successfully', document: updatedDoc });
        } else {
            res.status(404).json({ error: 'Document not found' });
        }
    });

    server.delete('/api/documents/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const index = documents.findIndex(doc => doc.serialNumber === id);
        if (index !== -1) {
            documents.splice(index, 1);
            renumberDocuments();
            res.json({ message: 'Document deleted successfully' });
        } else {
            res.status(404).json({ error: 'Document not found' });
        }
    });

    server.get('/api/documents', (req, res) => {
        const sortedDocuments = [...documents].sort((a, b) => b.serialNumber - a.serialNumber);
        console.log('Sending documents:', sortedDocuments.map(d => d.serialNumber));
        res.json(sortedDocuments);
    });

    server.get('/api/documents/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const document = documents.find(doc => doc.serialNumber === id);
        if (document) {
            res.json(document);
        } else {
            res.status(404).json({ error: 'Document not found' });
        }
    });

    server.get('/api/export', (req, res) => {
        const csvWriter = csv({
            path: path.join(app.getPath('downloads'), 'documents.csv'),
            header: [
                {id: 'serialNumber', title: 'Serial Number'},
                {id: 'referenceID', title: 'Reference ID'},
                {id: 'dateOfDocument', title: 'Date of Document'},
                {id: 'subject', title: 'Subject'},
                {id: 'fromEntity', title: 'From (Entity)'},
                {id: 'toEntity', title: 'To (Entity)'},
                {id: 'actions', title: 'Actions'},
                {id: 'deadlineDate', title: 'Deadline Date', transform: value => value ? new Date(value).toLocaleDateString() : ''}
            ]
        });

        csvWriter.writeRecords(documents)
            .then(() => {
                res.download(path.join(app.getPath('downloads'), 'documents.csv'), 'documents.csv');
            })
            .catch((error) => {
                console.error('Error exporting to CSV:', error);
                res.status(500).json({ error: 'An error occurred while exporting to CSV' });
            });
    });

    // Start the server
    const PORT = 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        mainWindow.loadURL(`http://localhost:${PORT}`);
        mainWindow.show();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});