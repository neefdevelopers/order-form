const express = require('express');
const router = express.Router();

// In-memory cache for fast repeated pincode lookups
const pincodeCache = new Map();

router.get('/pincode/:pincode', async (req, res) => {
  try {
    const rawPincode = (req.params.pincode || '').trim();
    const cleanPincode = rawPincode.replace(/\D/g, '');

    if (cleanPincode.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Pincode must be a 6-digit numeric code' 
      });
    }

    // Return cached entry if already fetched
    if (pincodeCache.has(cleanPincode)) {
      return res.json(pincodeCache.get(cleanPincode));
    }

    // Query official India Post API
    const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPincode}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(502).json({ 
        success: false, 
        error: 'Failed to contact India Post service' 
      });
    }

    const data = await response.json();
    if (
      !Array.isArray(data) || 
      !data[0] || 
      data[0].Status !== 'Success' || 
      !data[0].PostOffice || 
      data[0].PostOffice.length === 0
    ) {
      return res.status(404).json({ 
        success: false, 
        error: 'No postal records found for this pincode in India Post database' 
      });
    }

    const firstPO = data[0].PostOffice[0];
    const result = {
      success: true,
      pincode: cleanPincode,
      city: firstPO.District || firstPO.Block || firstPO.Name,
      state: firstPO.State,
      district: firstPO.District,
      postOffices: data[0].PostOffice.map((po) => po.Name.trim()).filter(Boolean)
    };

    pincodeCache.set(cleanPincode, result);
    return res.json(result);
  } catch (err) {
    console.error('Error fetching India Post pincode data:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Error querying India Post postal records' 
    });
  }
});

module.exports = router;

