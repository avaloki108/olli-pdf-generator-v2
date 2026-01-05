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
  const [newLocation, setNewLocation] = useState({
    location: '',
    address: '',
    town: '',
    comments: '',
    meetingNotes: ''
  });

  // File input ref for Excel import
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    generateDefaultWalks();
    generateDefaultHikes();
  }, [month, year]);

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
      meetingNotes: ''
    }));
    setWalks(defaultWalks);
  };

  const generateDefaultHikes = () => {
    setHikes([]);
  };

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
      meetingNotes: ''
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
    alert('Location added successfully!');
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setNewLocation({ ...location });
  };

  const handleUpdateLocation = () => {
    if (!newLocation.location.trim()) {
      alert('Please enter a location name');
      return;
    }
    
    const updatedLocations = locations.map(loc => 
      loc === editingLocation ? { ...newLocation } : loc
    );
    setLocations(sortLocations(updatedLocations));
    setEditingLocation(null);
    setNewLocation({
      location: '',
      address: '',
      town: '',
      comments: '',
      meetingNotes: ''
    });
    alert('Location updated successfully!');
  };

  const handleDeleteLocation = (location) => {
    if (window.confirm(`Are you sure you want to delete "${location.location}"?`)) {
      const updatedLocations = locations.filter(loc => loc !== location);
      setLocations(updatedLocations);
      alert('Location deleted successfully!');
    }
  };

  const handleCancelEdit = () => {
    setEditingLocation(null);
    setNewLocation({
      location: '',
      address: '',
      town: '',
      comments: '',
      meetingNotes: ''
    });
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
      const doc = new jsPDF('landscape', 'pt', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      let yOffset = 40;
      const margin = 40;
      const lineHeight = 16;
      const sectionSpacing = 25;
      const textFontSize = 11;
      const headerFontSize = 20;
      const subHeaderFontSize = 15;

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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(textFontSize);

      // Header
      doc.setFontSize(headerFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text(`${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`, margin, yOffset);
      yOffset += 25;
      
      doc.setFontSize(textFontSize);
      doc.setFont('helvetica', 'normal');
      doc.text('Olli Walks and Hikes Greater Denver Area / Facilitator: Pam Murdock 303-918-4566', margin, yOffset);
      yOffset += lineHeight + 3;
      
      doc.setTextColor(255, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('New, Short and Regular walks/hikes to accommodate all levels.', margin, yOffset);
      yOffset += lineHeight + 2;
      doc.text(`Start Time: ${startTimeHour}:${startTimeMinute} am at first starting point (carpool location or trailhead if no carpool)`, margin, yOffset);
      doc.setTextColor(0, 0, 0);
      yOffset += sectionSpacing;

      // Walks Section
      doc.setFontSize(subHeaderFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('WALKS – approximately 5.0 miles', margin, yOffset);
      yOffset += lineHeight + 5;
      
      doc.setFontSize(textFontSize);
      doc.text('Date', dateColX, yOffset);
      doc.text('Location', locationColX, yOffset);
      doc.text('Street Address', addressColX, yOffset);
      doc.text('Town', townColX, yOffset);
      doc.text('Comments', commentsColX, yOffset);
      yOffset += 5;
      
      doc.setLineWidth(1);
      doc.line(margin, yOffset, pageWidth - margin, yOffset);
      yOffset += 10;

      doc.setFont('helvetica', 'normal');
      for (let i = 0; i < walks.length; i++) {
        const walk = walks[i];
        let currentY = yOffset;
        let maxEntryHeight = lineHeight;
        
        doc.text(walk.date || '', dateColX, currentY);

        const wrappedLocation = doc.splitTextToSize(walk.location || '', locationColWidth - 5);
        wrappedLocation.forEach((line, idx) => {
          doc.text(line, locationColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedLocation.length * lineHeight);

        const wrappedAddress = doc.splitTextToSize(walk.address || '', addressColWidth - 5);
        wrappedAddress.forEach((line, idx) => {
          doc.text(line, addressColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedAddress.length * lineHeight);

        const wrappedTown = doc.splitTextToSize(walk.town || '', townColWidth - 5);
        wrappedTown.forEach((line, idx) => {
          doc.text(line, townColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedTown.length * lineHeight);
        
        let commentsText = walk.comments || '';
        if (walk.meetingNotes) {
          commentsText += (commentsText ? ' ' : '') + walk.meetingNotes;
        }
        const wrappedComments = doc.splitTextToSize(commentsText, commentsColWidth - 5);
        wrappedComments.forEach((line, idx) => {
          doc.text(line, commentsColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedComments.length * lineHeight);

        yOffset += maxEntryHeight;
        
        if (i < walks.length - 1) {
          yOffset += 5;
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.75);
          doc.line(margin, yOffset, pageWidth - margin, yOffset);
          doc.setDrawColor(0, 0, 0);
          yOffset += 10;
        }
      }
      
      yOffset += sectionSpacing;

      // Hikes Section
      doc.setFontSize(subHeaderFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('HIKES – approximately 5.0 miles', margin, yOffset);
      yOffset += lineHeight + 5;
      
      doc.setFontSize(textFontSize);
      doc.text('Date', dateColX, yOffset);
      doc.text('Location', locationColX, yOffset);
      doc.text('Street Address', addressColX, yOffset);
      doc.text('Town', townColX, yOffset);
      doc.text('Comments', commentsColX, yOffset);
      yOffset += 5;
      
      doc.setLineWidth(1);
      doc.line(margin, yOffset, pageWidth - margin, yOffset);
      yOffset += 10;

      doc.setFont('helvetica', 'normal');
      for (let i = 0; i < hikes.length; i++) {
        const hike = hikes[i];
        let currentY = yOffset;
        let maxEntryHeight = lineHeight;
        
        doc.text(hike.date || '', dateColX, currentY);

        const wrappedLocation = doc.splitTextToSize(hike.location || '', locationColWidth - 5);
        wrappedLocation.forEach((line, idx) => {
          doc.text(line, locationColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedLocation.length * lineHeight);

        const wrappedAddress = doc.splitTextToSize(hike.address || '', addressColWidth - 5);
        wrappedAddress.forEach((line, idx) => {
          doc.text(line, addressColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedAddress.length * lineHeight);

        const wrappedTown = doc.splitTextToSize(hike.town || '', townColWidth - 5);
        wrappedTown.forEach((line, idx) => {
          doc.text(line, townColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedTown.length * lineHeight);
        
        let commentsText = hike.comments || '';
        if (hike.meetingNotes) {
          commentsText += (commentsText ? ' ' : '') + hike.meetingNotes;
        }
        const wrappedComments = doc.splitTextToSize(commentsText, commentsColWidth - 5);
        wrappedComments.forEach((line, idx) => {
          doc.text(line, commentsColX, currentY + (idx * lineHeight));
        });
        maxEntryHeight = Math.max(maxEntryHeight, wrappedComments.length * lineHeight);

        yOffset += maxEntryHeight;
        
        if (i < hikes.length - 1) {
          yOffset += 5;
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.75);
          doc.line(margin, yOffset, pageWidth - margin, yOffset);
          doc.setDrawColor(0, 0, 0);
          yOffset += 10;
        }
      }
      
      yOffset += sectionSpacing;

      doc.setFontSize(textFontSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 0, 0);
      doc.text('Protocol for Hikes: Please text Pam the night before all hikes and let her know if you are hiking, 303 918 4566.', margin, yOffset);

      doc.save(`OLLI_Walks_Hikes_${new Date(year, month - 1).toLocaleString('default', { month: 'long' })}_${year}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Error generating PDF: ${error.message}`);
    }
  };

  const thursdaysInMonth = getThursdaysInMonth(month, year);
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

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
          <h2>Location Database Manager</h2>
          <p className="location-count">Total Locations: {locations.length}</p>
          
          <div className="location-form">
            <h3>{editingLocation ? 'Edit Location' : 'Add New Location'}</h3>
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
            <div className="form-buttons">
              {editingLocation ? (
                <>
                  <button onClick={handleUpdateLocation}>Update Location</button>
                  <button onClick={handleCancelEdit}>Cancel</button>
                </>
              ) : (
                <button onClick={handleAddLocation}>Add Location</button>
              )}
            </div>
          </div>

          <div className="location-actions">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInputRef.current.click()} className="import-btn">
              Import from Excel
            </button>
            <button onClick={handleResetToDefaults} className="reset-btn">
              Reset to Default Locations
            </button>
          </div>

          <div className="location-list">
            <h3>All Locations</h3>
            {locations.map((loc, index) => (
              <div key={index} className="location-item">
                <div className="location-info">
                  <h4>{loc.location}</h4>
                  <p><strong>Address:</strong> {loc.address || 'N/A'}</p>
                  <p><strong>Town:</strong> {loc.town || 'N/A'}</p>
                  {loc.comments && <p><strong>Comments:</strong> {loc.comments}</p>}
                  {loc.meetingNotes && <p><strong>Meeting Notes:</strong> {loc.meetingNotes}</p>}
                </div>
                <div className="location-actions">
                  <button onClick={() => handleEditLocation(loc)}>Edit</button>
                  <button onClick={() => handleDeleteLocation(loc)} className="delete-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <main>
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
                {[...Array(5).keys()].map(i => (
                  <option key={new Date().getFullYear() + i} value={new Date().getFullYear() + i}>
                    {new Date().getFullYear() + i}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="form-section">
            <h2>2. Set Start Time</h2>
            <div className="dropdown-container">
              <select value={startTimeHour} onChange={(e) => setStartTimeHour(e.target.value)}>
                {hourOptions.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span>:</span>
              <select value={startTimeMinute} onChange={(e) => setStartTimeMinute(e.target.value)}>
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
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
