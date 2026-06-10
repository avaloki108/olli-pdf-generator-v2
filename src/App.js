import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import defaultLocations from './extracted_locations.json';

function App() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [walks, setWalks] = useState([]);
  const [hikes, setHikes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [startTimeHour, setStartTimeHour] = useState('08');
  const [startTimeMinute, setStartTimeMinute] = useState('30');
  
  // Location management state
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocation, setNewLocation] = useState({
    location: '',
    address: '',
    town: '',
    comments: '',
    meetingNotes: ''
  });

  // File input ref for Excel import
  const fileInputRef = useRef(null);

  // Saved schedules (one per month/year, stored in localStorage)
  const [savedSchedules, setSavedSchedules] = useState([]);
  const scheduleLoadedRef = useRef(false);

  const SCHEDULE_PREFIX = 'olliSchedule_';
  const scheduleKey = (y, m) => `${SCHEDULE_PREFIX}${y}-${String(m).padStart(2, '0')}`;
  const monthLabel = (y, m) => `${new Date(y, m - 1).toLocaleString('default', { month: 'long' })} ${y}`;

  const listSavedSchedules = () => {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SCHEDULE_PREFIX)) continue;
      const [y, m] = key.slice(SCHEDULE_PREFIX.length).split('-').map(Number);
      if (!y || !m) continue;
      let savedAt = null;
      try {
        savedAt = JSON.parse(localStorage.getItem(key)).savedAt;
      } catch (e) { /* ignore corrupt entries */ }
      list.push({ key, year: y, month: m, label: monthLabel(y, m), savedAt });
    }
    return list.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  };

  // Load locations from localStorage or use defaults
  useEffect(() => {
    console.log('=== LOCATION LOADING DEBUG ===');
    console.log('defaultLocations imported:', defaultLocations);
    console.log('defaultLocations count:', defaultLocations ? defaultLocations.length : 0);
    
    const savedLocations = localStorage.getItem('olliLocations');
    console.log('localStorage has data:', !!savedLocations);
    
    if (savedLocations) {
      try {
        const parsed = JSON.parse(savedLocations);
        console.log('Loaded from localStorage, count:', parsed.length);
        setLocations(sortLocations(parsed));
      } catch (e) {
        console.error('Error loading saved locations:', e);
        console.log('Using defaultLocations due to error');
        setLocations(sortLocations(defaultLocations));
      }
    } else {
      console.log('No localStorage, using defaultLocations');
      setLocations(sortLocations(defaultLocations));
    }
  }, []);

  // Save locations to localStorage whenever they change
  useEffect(() => {
    if (locations.length > 0) {
      localStorage.setItem('olliLocations', JSON.stringify(locations));
    }
  }, [locations]);

  // Load the saved schedule for the selected month/year, or start fresh
  useEffect(() => {
    const saved = localStorage.getItem(scheduleKey(year, month));
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Older saved schedules only had one global time — copy it onto each day
        const withTimes = (list) => (list || []).map(e => ({
          ...e,
          startHour: e.startHour || data.startTimeHour || '08',
          startMinute: e.startMinute || data.startTimeMinute || '30'
        }));
        setWalks(withTimes(data.walks));
        setHikes(withTimes(data.hikes));
        if (data.startTimeHour) setStartTimeHour(data.startTimeHour);
        if (data.startTimeMinute) setStartTimeMinute(data.startTimeMinute);
        scheduleLoadedRef.current = true;
        return;
      } catch (e) {
        console.error('Error loading saved schedule:', e);
      }
    }
    generateDefaultWalks();
    generateDefaultHikes();
    scheduleLoadedRef.current = true;
  }, [month, year]);

  // Auto-save the schedule whenever it changes
  useEffect(() => {
    if (!scheduleLoadedRef.current) return;
    const key = scheduleKey(year, month);
    const hasContent =
      walks.some(w => w.location || w.address || w.town || w.comments || w.meetingNotes) ||
      hikes.length > 0;
    // Don't create a saved entry for months that are still untouched
    if (!hasContent && !localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({
      walks,
      hikes,
      startTimeHour,
      startTimeMinute,
      savedAt: new Date().toISOString()
    }));
    setSavedSchedules(listSavedSchedules());
  }, [walks, hikes, startTimeHour, startTimeMinute]);

  // Build the saved-schedules list on startup
  useEffect(() => {
    setSavedSchedules(listSavedSchedules());
  }, []);

  const handleOpenSchedule = (sched) => {
    setMonth(sched.month);
    setYear(sched.year);
    window.scrollTo(0, 0);
  };

  const handleDeleteSchedule = (sched) => {
    if (!window.confirm(`Delete the saved schedule for ${sched.label}? This cannot be undone.`)) return;
    localStorage.removeItem(sched.key);
    if (sched.year === year && sched.month === month) {
      generateDefaultWalks();
      generateDefaultHikes();
    }
    setSavedSchedules(listSavedSchedules());
  };

  const sortLocations = (locs) => {
    return [...locs].sort((a, b) => 
      a.location.localeCompare(b.location, undefined, { 
        sensitivity: 'base',
        numeric: true,
        ignorePunctuation: true 
      })
    );
  };

  const getMondaysInMonth = (month, year) => {
    const mondays = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 1) {
        mondays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return mondays;
  };

  const getThursdaysInMonth = (month, year) => {
    const thursdays = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 4) {
        thursdays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return thursdays;
  };

  const generateDefaultWalks = () => {
    const mondays = getMondaysInMonth(month, year);
    const defaultWalks = mondays.map(monday => ({
      date: monday.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
      location: '',
      address: '',
      town: '',
      comments: '',
      meetingNotes: '',
      startHour: startTimeHour,
      startMinute: startTimeMinute
    }));
    setWalks(defaultWalks);
  };

  const generateDefaultHikes = () => {
    setHikes([]);
  };

  // Changing the main start time applies it to every walk and hike
  const handleGlobalTimeChange = (field, value) => {
    if (field === 'hour') setStartTimeHour(value);
    else setStartTimeMinute(value);
    const entryField = field === 'hour' ? 'startHour' : 'startMinute';
    setWalks(walks.map(e => ({ ...e, [entryField]: value })));
    setHikes(hikes.map(e => ({ ...e, [entryField]: value })));
  };

  const formatEntryTime = (entry) =>
    `${parseInt(entry.startHour || startTimeHour, 10)}:${entry.startMinute || startTimeMinute} am`;

  const handleLocationChange = (type, index, field, value) => {
    const list = type === 'walk' ? [...walks] : [...hikes];
    list[index][field] = value;

    if (field === 'location') {
      const selectedLocation = locations.find(loc => loc.location === value);
      if (selectedLocation) {
        list[index].address = selectedLocation.address || '';
        list[index].town = selectedLocation.town || '';
        list[index].comments = selectedLocation.comments || '';
        list[index].meetingNotes = selectedLocation.meetingNotes || '';
      }
    }

    if (type === 'walk') {
      setWalks(list);
    } else {
      setHikes(list);
    }
  };

  const addEntry = (type) => {
    const newEntry = {
      date: '',
      location: '',
      address: '',
      town: '',
      comments: '',
      meetingNotes: '',
      startHour: startTimeHour,
      startMinute: startTimeMinute
    };
    if (type === 'walk') {
      setWalks([...walks, newEntry]);
    } else {
      setHikes([...hikes, newEntry]);
    }
  };

  const removeEntry = (type, index) => {
    if (type === 'walk') {
      const newWalks = [...walks];
      newWalks.splice(index, 1);
      setWalks(newWalks);
    } else {
      const newHikes = [...hikes];
      newHikes.splice(index, 1);
      setHikes(newHikes);
    }
  };

  // Location Management Functions
  const handleAddLocation = () => {
    if (!newLocation.location.trim()) {
      alert('Please enter a location name');
      return;
    }

    const updatedLocations = sortLocations([...locations, { ...newLocation }]);
    setLocations(updatedLocations);
    setNewLocation({
      location: '',
      address: '',
      town: '',
      comments: '',
      meetingNotes: ''
    });
    setShowAddForm(false);
    alert('Location added successfully!');
  };

  const handleStartEdit = (location) => {
    setEditingLocation(location);
    setEditDraft({ ...location });
  };

  const handleSaveEdit = () => {
    if (!editDraft.location.trim()) {
      alert('Please enter a location name');
      return;
    }

    const updatedLocations = locations.map(loc =>
      loc === editingLocation ? { ...editDraft } : loc
    );
    setLocations(sortLocations(updatedLocations));
    setEditingLocation(null);
    setEditDraft(null);
  };

  const handleDeleteLocation = (location) => {
    if (window.confirm(`Are you sure you want to delete "${location.location}"?`)) {
      const updatedLocations = locations.filter(loc => loc !== location);
      setLocations(updatedLocations);
    }
  };

  const handleCancelEdit = () => {
    setEditingLocation(null);
    setEditDraft(null);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all locations to defaults? This will delete all custom locations.')) {
      setLocations(sortLocations(defaultLocations));
      localStorage.setItem('olliLocations', JSON.stringify(defaultLocations));
      alert('Locations reset to defaults!');
    }
  };

  // Excel Import Handler
  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first sheet (or 'walks and hikes' if it exists)
        const sheetName = workbook.SheetNames.includes('walks and hikes')
          ? 'walks and hikes'
          : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (array of arrays)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Find header row and map columns
        // Expected columns: Mon, Location, Street Address, Town, Meeting Location Notes, Comments
        const headerRow = rawData[0];
        const columnMap = {};
        headerRow.forEach((header, index) => {
          const h = (header || '').toString().toLowerCase().trim();
          if (h === 'location') columnMap.location = index;
          else if (h === 'street address' || h === 'address') columnMap.address = index;
          else if (h === 'town') columnMap.town = index;
          else if (h.includes('meeting') && h.includes('notes')) columnMap.meetingNotes = index;
          else if (h === 'comments') columnMap.comments = index;
        });

        // Parse locations from data rows
        const importedLocations = [];
        const seenLocations = new Set();

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const locationName = row[columnMap.location];
          if (!locationName || typeof locationName !== 'string' || !locationName.trim()) continue;

          // Skip header-like rows (e.g., "OLLI WALKS", "OLLI HIKES")
          const nameLower = locationName.toLowerCase().trim();
          if (nameLower.startsWith('olli ') || nameLower === 'location') continue;

          // Skip duplicates within the import
          const nameKey = locationName.trim().toLowerCase();
          if (seenLocations.has(nameKey)) continue;
          seenLocations.add(nameKey);

          importedLocations.push({
            location: locationName.trim(),
            address: (row[columnMap.address] || '').toString().trim(),
            town: (row[columnMap.town] || '').toString().trim(),
            meetingNotes: (row[columnMap.meetingNotes] || '').toString().trim(),
            comments: (row[columnMap.comments] || '').toString().trim()
          });
        }

        if (importedLocations.length === 0) {
          alert('No valid locations found in the Excel file. Make sure the file has a "Location" column.');
          return;
        }

        // Ask user how to handle import
        const action = window.confirm(
          `Found ${importedLocations.length} unique locations.\n\n` +
          `Click OK to REPLACE all existing locations.\n` +
          `Click Cancel to MERGE with existing locations.`
        );

        let finalLocations;
        if (action) {
          // Replace all
          finalLocations = importedLocations;
        } else {
          // Merge: add new locations, skip existing ones
          const existingNames = new Set(locations.map(l => l.location.toLowerCase().trim()));
          const newLocations = importedLocations.filter(
            loc => !existingNames.has(loc.location.toLowerCase().trim())
          );
          finalLocations = [...locations, ...newLocations];
          alert(`Added ${newLocations.length} new locations. ${importedLocations.length - newLocations.length} duplicates were skipped.`);
        }

        setLocations(sortLocations(finalLocations));
        alert(`Import complete! Total locations: ${finalLocations.length}`);

      } catch (error) {
        console.error('Error importing Excel:', error);
        alert(`Error importing file: ${error.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset file input so the same file can be selected again
    event.target.value = '';
  };

  const generatePdf = async () => {
    try {
      const allEntries = [...walks, ...hikes];
      // If every day starts at the same time, keep the single header line;
      // otherwise print each day's time under its date
      const timesUniform = allEntries.length === 0 ||
        allEntries.every(e => formatEntryTime(e) === formatEntryTime(allEntries[0]));

      // Draws the whole schedule at the given scale and returns the bottom y position
      const renderSchedule = (doc, scale) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 40;
        const lineHeight = 16 * scale;
        const sectionSpacing = 25 * scale;
        const textFontSize = 11 * scale;
        const headerFontSize = 20 * scale;
        const subHeaderFontSize = 15 * scale;

        const dateColX = margin;
        const dateColWidth = 65;
        const locationColX = dateColX + dateColWidth + 5;
        const locationColWidth = 130;
        const addressColX = locationColX + locationColWidth + 5;
        const addressColWidth = 120;
        const townColX = addressColX + addressColWidth + 5;
        const townColWidth = 80;
        const commentsColX = townColX + townColWidth + 5;
        const commentsColWidth = pageWidth - commentsColX - margin - 10;

        let yOffset = 40;

        // Header
        doc.setFontSize(headerFontSize);
        doc.setFont('helvetica', 'bold');
        doc.text(`${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`, margin, yOffset);
        yOffset += 25 * scale;

        doc.setFontSize(textFontSize);
        doc.setFont('helvetica', 'normal');
        doc.text('Olli Walks and Hikes Greater Denver Area / Facilitator: Pam Murdock 303-918-4566', margin, yOffset);
        yOffset += lineHeight + 3 * scale;

        doc.setTextColor(255, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('New, Short and Regular walks/hikes to accommodate all levels.', margin, yOffset);
        yOffset += lineHeight + 2 * scale;
        if (timesUniform) {
          const time = allEntries.length > 0
            ? formatEntryTime(allEntries[0])
            : `${parseInt(startTimeHour, 10)}:${startTimeMinute} am`;
          doc.text(`Start Time: ${time} at first starting point (carpool location or trailhead if no carpool)`, margin, yOffset);
        } else {
          doc.text('Start times are listed for each day, at first starting point (carpool location or trailhead if no carpool)', margin, yOffset);
        }
        doc.setTextColor(0, 0, 0);
        yOffset += sectionSpacing;

        const drawSection = (title, entries) => {
          doc.setFontSize(subHeaderFontSize);
          doc.setFont('helvetica', 'bold');
          doc.text(title, margin, yOffset);
          yOffset += lineHeight + 5 * scale;

          doc.setFontSize(textFontSize);
          doc.text('Date', dateColX, yOffset);
          doc.text('Location', locationColX, yOffset);
          doc.text('Street Address', addressColX, yOffset);
          doc.text('Town', townColX, yOffset);
          doc.text('Comments', commentsColX, yOffset);
          yOffset += 5 * scale;

          doc.setLineWidth(1);
          doc.line(margin, yOffset, pageWidth - margin, yOffset);
          yOffset += 10 * scale;

          doc.setFont('helvetica', 'normal');
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const currentY = yOffset;
            let maxEntryHeight = lineHeight;

            const dateLines = [entry.date || ''];
            if (!timesUniform) {
              dateLines.push(formatEntryTime(entry));
            }
            dateLines.forEach((line, idx) => {
              doc.text(line, dateColX, currentY + (idx * lineHeight));
            });
            maxEntryHeight = Math.max(maxEntryHeight, dateLines.length * lineHeight);

            const drawColumn = (text, x, width) => {
              const wrapped = doc.splitTextToSize(text || '', width - 5);
              wrapped.forEach((line, idx) => {
                doc.text(line, x, currentY + (idx * lineHeight));
              });
              maxEntryHeight = Math.max(maxEntryHeight, wrapped.length * lineHeight);
            };

            drawColumn(entry.location, locationColX, locationColWidth);
            drawColumn(entry.address, addressColX, addressColWidth);
            drawColumn(entry.town, townColX, townColWidth);

            let commentsText = entry.comments || '';
            if (entry.meetingNotes) {
              commentsText += (commentsText ? ' ' : '') + entry.meetingNotes;
            }
            drawColumn(commentsText, commentsColX, commentsColWidth);

            yOffset += maxEntryHeight;

            if (i < entries.length - 1) {
              yOffset += 5 * scale;
              doc.setDrawColor(180, 180, 180);
              doc.setLineWidth(0.75);
              doc.line(margin, yOffset, pageWidth - margin, yOffset);
              doc.setDrawColor(0, 0, 0);
              yOffset += 10 * scale;
            }
          }
        };

        drawSection('WALKS – approximately 5.0 miles', walks);
        yOffset += sectionSpacing;
        drawSection('HIKES – approximately 5.0 miles', hikes);
        yOffset += sectionSpacing;

        doc.setFontSize(textFontSize);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 0, 0);
        doc.text('Protocol for Hikes: Please text Pam the night before all hikes and let her know if you are hiking, 303 918 4566.', margin, yOffset);
        doc.setTextColor(0, 0, 0);

        return yOffset;
      };

      // Fit everything on one page: shrink text until the content fits
      const minScale = 0.45;
      let scale = 1;
      let doc = new jsPDF('landscape', 'pt', 'letter');
      const maxY = doc.internal.pageSize.getHeight() - 30;
      let usedHeight = renderSchedule(doc, scale);
      let attempts = 0;
      while (usedHeight > maxY && scale > minScale && attempts < 10) {
        // Estimate the needed shrink, with a small extra margin; smaller text
        // also wraps onto fewer lines, so this converges quickly
        scale = Math.max(minScale, scale * (maxY / usedHeight) * 0.99);
        doc = new jsPDF('landscape', 'pt', 'letter');
        usedHeight = renderSchedule(doc, scale);
        attempts++;
      }

      doc.save(`OLLI_Walks_Hikes_${new Date(year, month - 1).toLocaleString('default', { month: 'long' })}_${year}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Error generating PDF: ${error.message}`);
    }
  };

  const thursdaysInMonth = getThursdaysInMonth(month, year);
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  // Include the selected year even if it's outside the normal range (e.g. opening last year's schedule)
  const yearOptions = [...new Set([year, ...Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i)])].sort();
  const currentScheduleSaved = savedSchedules.some(s => s.year === year && s.month === month);

  return (
    <div className="App">
      <header className="App-header">
        <h1>OLLI Walks & Hikes PDF Generator</h1>
        <button 
          className="manage-locations-btn"
          onClick={() => setShowLocationManager(!showLocationManager)}
        >
          {showLocationManager ? 'Close' : 'Manage Locations'}
        </button>
      </header>

      {showLocationManager ? (
        <main className="location-manager">
          <div className="lm-header">
            <h2>Location Database</h2>
            <p className="location-count">{locations.length} locations</p>
          </div>

          <div className="lm-toolbar">
            <div className="lm-search-wrap">
              <input
                type="text"
                className="lm-search"
                placeholder="Search locations..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
              />
              {locationSearch && (
                <button className="lm-search-clear" onClick={() => setLocationSearch('')}>Clear</button>
              )}
            </div>
            <button
              className="lm-add-btn"
              onClick={() => { setShowAddForm(!showAddForm); setEditingLocation(null); setEditDraft(null); }}
            >
              {showAddForm ? 'Cancel' : '+ Add Location'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInputRef.current.click()} className="import-btn">
              Import Excel
            </button>
            <button onClick={handleResetToDefaults} className="reset-btn">
              Reset Defaults
            </button>
          </div>

          {showAddForm && (
            <div className="lm-add-form">
              <input
                type="text"
                placeholder="Location Name *"
                value={newLocation.location}
                onChange={(e) => setNewLocation({ ...newLocation, location: e.target.value })}
              />
              <input
                type="text"
                placeholder="Street Address"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
              />
              <input
                type="text"
                placeholder="Town"
                value={newLocation.town}
                onChange={(e) => setNewLocation({ ...newLocation, town: e.target.value })}
              />
              <textarea
                placeholder="Comments"
                value={newLocation.comments}
                onChange={(e) => setNewLocation({ ...newLocation, comments: e.target.value })}
              />
              <textarea
                placeholder="Meeting Location Notes"
                value={newLocation.meetingNotes}
                onChange={(e) => setNewLocation({ ...newLocation, meetingNotes: e.target.value })}
              />
              <button onClick={handleAddLocation}>Add Location</button>
            </div>
          )}

          <div className="lm-table-wrap">
            <table className="lm-table">
              <thead>
                <tr>
                  <th className="lm-th-name">Location</th>
                  <th className="lm-th-addr">Address</th>
                  <th className="lm-th-town">Town</th>
                  <th className="lm-th-notes">Comments / Notes</th>
                  <th className="lm-th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {locations
                  .filter(loc => {
                    if (!locationSearch.trim()) return true;
                    const q = locationSearch.toLowerCase();
                    return (
                      loc.location.toLowerCase().includes(q) ||
                      (loc.address || '').toLowerCase().includes(q) ||
                      (loc.town || '').toLowerCase().includes(q) ||
                      (loc.comments || '').toLowerCase().includes(q) ||
                      (loc.meetingNotes || '').toLowerCase().includes(q)
                    );
                  })
                  .map((loc, index) => {
                    const isEditing = loc === editingLocation;
                    return (
                      <tr key={index} className={isEditing ? 'lm-row-editing' : ''}>
                        {isEditing ? (
                          <>
                            <td><input className="lm-inline-input" value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} /></td>
                            <td><input className="lm-inline-input" value={editDraft.address} onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })} /></td>
                            <td><input className="lm-inline-input" value={editDraft.town} onChange={(e) => setEditDraft({ ...editDraft, town: e.target.value })} /></td>
                            <td>
                              <input className="lm-inline-input" placeholder="Comments" value={editDraft.comments} onChange={(e) => setEditDraft({ ...editDraft, comments: e.target.value })} />
                              <input className="lm-inline-input lm-inline-notes" placeholder="Meeting notes" value={editDraft.meetingNotes} onChange={(e) => setEditDraft({ ...editDraft, meetingNotes: e.target.value })} />
                            </td>
                            <td className="lm-td-actions">
                              <button className="lm-btn-save" onClick={handleSaveEdit}>Save</button>
                              <button className="lm-btn-cancel" onClick={handleCancelEdit}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="lm-td-name"><strong>{loc.location}</strong></td>
                            <td className="lm-td-addr">{loc.address || '—'}</td>
                            <td className="lm-td-town">{loc.town || '—'}</td>
                            <td className="lm-td-notes">
                              {loc.comments || ''}
                              {loc.comments && loc.meetingNotes ? ' ' : ''}
                              {loc.meetingNotes ? <span className="lm-notes-tag">{loc.meetingNotes}</span> : ''}
                            </td>
                            <td className="lm-td-actions">
                              <button onClick={() => handleStartEdit(loc)}>Edit</button>
                              <button onClick={() => handleDeleteLocation(loc)} className="delete-btn">Delete</button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {(() => {
              const count = locations.filter(loc => {
                if (!locationSearch.trim()) return true;
                const q = locationSearch.toLowerCase();
                return (
                  loc.location.toLowerCase().includes(q) ||
                  (loc.address || '').toLowerCase().includes(q) ||
                  (loc.town || '').toLowerCase().includes(q) ||
                  (loc.comments || '').toLowerCase().includes(q) ||
                  (loc.meetingNotes || '').toLowerCase().includes(q)
                );
              }).length;
              return locationSearch.trim() ? <p className="lm-results-count">Showing {count} of {locations.length} locations</p> : null;
            })()}
          </div>
        </main>
      ) : (
        <main>
          {savedSchedules.length > 0 && (
            <section className="form-section saved-schedules">
              <h2>Your Saved Schedules</h2>
              <p className="autosave-note">
                Your work is saved automatically as you type. Click "Open" to continue working on a schedule.
              </p>
              {savedSchedules.map(sched => (
                <div key={sched.key} className={`saved-schedule-item${sched.year === year && sched.month === month ? ' current' : ''}`}>
                  <div className="saved-schedule-info">
                    <strong>{sched.label}</strong>
                    {sched.year === year && sched.month === month && <span className="open-now-badge">Open now</span>}
                    {sched.savedAt && (
                      <span className="saved-at">
                        Last saved: {new Date(sched.savedAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <div className="saved-schedule-actions">
                    {!(sched.year === year && sched.month === month) && (
                      <button onClick={() => handleOpenSchedule(sched)}>Open</button>
                    )}
                    <button onClick={() => handleDeleteSchedule(sched)} className="delete-btn">Delete</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="form-section">
            <h2>1. Select Month and Year</h2>
            <div className="dropdown-container">
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                {[...Array(12).keys()].map(i => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="form-section">
            <h2>2. Set Start Time</h2>
            <p className="section-note">
              This sets the time for every day at once. You can change the time for any single day in its walk or hike box below.
            </p>
            <div className="dropdown-container">
              <select value={startTimeHour} onChange={(e) => handleGlobalTimeChange('hour', e.target.value)}>
                {hourOptions.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span>:</span>
              <select value={startTimeMinute} onChange={(e) => handleGlobalTimeChange('minute', e.target.value)}>
                {minuteOptions.map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
              <span>AM</span>
            </div>
          </section>

          <section className="form-section">
            <h2>3. Edit Walks</h2>
            {walks.map((walk, index) => (
              <div key={index} className="entry-item">
                <h3>Walk {index + 1}</h3>
                <input
                  type="text"
                  placeholder="Date (MM/DD/YY)"
                  value={walk.date}
                  onChange={(e) => handleLocationChange('walk', index, 'date', e.target.value)}
                  readOnly
                />
                <div className="entry-time">
                  <label>Start Time:</label>
                  <select
                    value={walk.startHour || startTimeHour}
                    onChange={(e) => handleLocationChange('walk', index, 'startHour', e.target.value)}
                  >
                    {hourOptions.map(hour => (
                      <option key={hour} value={hour}>{hour}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={walk.startMinute || startTimeMinute}
                    onChange={(e) => handleLocationChange('walk', index, 'startMinute', e.target.value)}
                  >
                    {minuteOptions.map(minute => (
                      <option key={minute} value={minute}>{minute}</option>
                    ))}
                  </select>
                  <span>AM</span>
                </div>
                <select
                  value={walk.location}
                  onChange={(e) => handleLocationChange('walk', index, 'location', e.target.value)}
                >
                  <option value="">Select Location</option>
                  {locations.map((loc, idx) => (
                    <option key={idx} value={loc.location}>
                      {loc.location}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Address"
                  value={walk.address}
                  onChange={(e) => handleLocationChange('walk', index, 'address', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Town"
                  value={walk.town}
                  onChange={(e) => handleLocationChange('walk', index, 'town', e.target.value)}
                />
                <textarea
                  placeholder="Comments"
                  value={walk.comments}
                  onChange={(e) => handleLocationChange('walk', index, 'comments', e.target.value)}
                ></textarea>
                <textarea
                  placeholder="Meeting Location Notes"
                  value={walk.meetingNotes}
                  onChange={(e) => handleLocationChange('walk', index, 'meetingNotes', e.target.value)}
                ></textarea>
                <button onClick={() => removeEntry('walk', index)}>Remove</button>
              </div>
            ))}
            <button onClick={() => addEntry('walk')}>Add Walk</button>
          </section>

          <section className="form-section">
            <h2>4. Edit Hikes</h2>
            {hikes.map((hike, index) => (
              <div key={index} className="entry-item">
                <h3>Hike {index + 1}</h3>
                <select
                  value={hike.date}
                  onChange={(e) => handleLocationChange('hike', index, 'date', e.target.value)}
                >
                  <option value="">Select Thursday Date</option>
                  {thursdaysInMonth.map((thu, idx) => (
                    <option key={idx} value={thu.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}>
                      {thu.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                    </option>
                  ))}
                </select>
                <div className="entry-time">
                  <label>Start Time:</label>
                  <select
                    value={hike.startHour || startTimeHour}
                    onChange={(e) => handleLocationChange('hike', index, 'startHour', e.target.value)}
                  >
                    {hourOptions.map(hour => (
                      <option key={hour} value={hour}>{hour}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={hike.startMinute || startTimeMinute}
                    onChange={(e) => handleLocationChange('hike', index, 'startMinute', e.target.value)}
                  >
                    {minuteOptions.map(minute => (
                      <option key={minute} value={minute}>{minute}</option>
                    ))}
                  </select>
                  <span>AM</span>
                </div>
                <select
                  value={hike.location}
                  onChange={(e) => handleLocationChange('hike', index, 'location', e.target.value)}
                >
                  <option value="">Select Location</option>
                  {locations.map((loc, idx) => (
                    <option key={idx} value={loc.location}>
                      {loc.location}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Address"
                  value={hike.address}
                  onChange={(e) => handleLocationChange('hike', index, 'address', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Town"
                  value={hike.town}
                  onChange={(e) => handleLocationChange('hike', index, 'town', e.target.value)}
                />
                <textarea
                  placeholder="Comments"
                  value={hike.comments}
                  onChange={(e) => handleLocationChange('hike', index, 'comments', e.target.value)}
                ></textarea>
                <textarea
                  placeholder="Meeting Location Notes"
                  value={hike.meetingNotes}
                  onChange={(e) => handleLocationChange('hike', index, 'meetingNotes', e.target.value)}
                ></textarea>
                <button onClick={() => removeEntry('hike', index)}>Remove</button>
              </div>
            ))}
            <button onClick={() => addEntry('hike')}>Add Hike</button>
          </section>

          <section className="form-section">
            <h2>5. Generate PDF</h2>
            <button onClick={generatePdf}>Generate PDF</button>
            <p className="autosave-note">
              {currentScheduleSaved
                ? `✓ Your ${monthLabel(year, month)} schedule is saved. You can close the app and come back to fix anything later.`
                : 'Your work will be saved automatically as soon as you start filling in the schedule.'}
            </p>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
