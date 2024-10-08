const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf')
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    }
});

app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dataFile = path.join(__dirname, 'data.json');

// Load existing data or initialize empty array
let documents = [];
if (fs.existsSync(dataFile)) {
    const data = fs.readFileSync(dataFile, 'utf8');
    documents = JSON.parse(data);
}

function saveData() {
    fs.writeFileSync(dataFile, JSON.stringify(documents, null, 2));
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/documents', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'actionPdf', maxCount: 1 }]), (req, res) => {
    try {
        const newDoc = req.body;
        if (!newDoc.referenceID || !newDoc.subject || !newDoc.fromEntity || !newDoc.toEntity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Set the serial number to be one more than the current maximum
        const maxSerialNumber = Math.max(...documents.map(doc => doc.serialNumber), 0);
        newDoc.serialNumber = maxSerialNumber + 1;
        
        // Automatically set the current date
        newDoc.dateOfDocument = new Date().toISOString().split('T')[0];
        
        if (req.files.pdf) {
            newDoc.pdfPath = '/uploads/' + path.basename(req.files.pdf[0].path);
        }
        if (req.files.actionPdf) {
            newDoc.actionPdfPath = '/uploads/' + path.basename(req.files.actionPdf[0].path);
        }
        
        documents.unshift(newDoc);  // Add new document to the beginning of the array
        saveData();
        return res.json({ message: 'Document added successfully', document: newDoc });
    } catch (error) {
        console.error('Error adding document:', error);
        return res.status(500).json({ error: 'An error occurred while adding the document' });
    }
});

app.put('/api/documents/:id', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'actionPdf', maxCount: 1 }]), (req, res) => {
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

app.delete('/api/documents/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = documents.findIndex(doc => doc.serialNumber === id);
    if (index !== -1) {
        documents.splice(index, 1);
        saveData();
        res.json({ message: 'Document deleted successfully' });
    } else {
        res.status(404).json({ error: 'Document not found' });
    }
});

app.get('/api/documents', (req, res) => {
    res.json(documents);  // Send documents as is, no sorting needed
});

app.get('/api/documents/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const document = documents.find(doc => doc.serialNumber === id);
    if (document) {
        res.json(document);
    } else {
        res.status(404).json({ error: 'Document not found' });
    }
});

app.get('/uploads/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(file);
});

app.get('/api/export', (req, res) => {
    const csvWriter = csv({
        path: 'export.csv',
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
            res.download('export.csv', 'documents.csv', (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                }
                fs.unlinkSync('export.csv');
            });
        })
        .catch((error) => {
            console.error('Error exporting to CSV:', error);
            res.status(500).json({ error: 'An error occurred while exporting to CSV' });
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});