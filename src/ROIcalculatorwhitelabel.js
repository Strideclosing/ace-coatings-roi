// ROIcalculatorwhitelabel.js

import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  LineController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  Typography,
  Container,
  Paper,
  Slider,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Box,
  Drawer,
  Button
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// Plugin: Draw a gradient background in the chart area
const gradientBgPlugin = {
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;
    const gradient = ctx.createLinearGradient(chartArea.left, chartArea.top, chartArea.right, chartArea.bottom);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#e0e0e0');
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.restore();
  }
};

// Register Chart.js components and the gradient plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  ChartTooltip,
  Legend,
  gradientBgPlugin
);

// Configuration object for white-label defaults and labels
const config = {
  title: "Ace Coatings Franchise Projection",
  defaultPricing: 300,
  defaultInitialInvestment: 10000,
  defaultTimeFrame: 12,
  defaultScaleSpeed: "medium", // Options: "slow", "medium", "fast"
};

// Create a theme with a light grey gradient background, regal blue primary, and sharper corners
const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#f0f0f0', paper: '#ffffff' },
    primary: { main: '#3F51B5' },
    text: { primary: '#000000' },
  },
  typography: { fontFamily: "'Roboto', sans-serif", h4: { fontWeight: 700 } },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)',
        },
      },
    },
  },
});

// Slider style overrides for a regal blue appearance
const sliderSx = {
  color: '#3F51B5',
  '& .MuiSlider-thumb': {
    backgroundColor: '#3F51B5',
  },
  '& .MuiSlider-track': {
    color: '#3F51B5',
  },
  '& .MuiSlider-rail': {
    color: '#cfd8dc',
  },
};

const ROICalculatorWhiteLabel = () => {
  const [pricing, setPricing] = useState(config.defaultPricing);
  const [initialInvestment, setInitialInvestment] = useState(config.defaultInitialInvestment);
  const [timeFrame, setTimeFrame] = useState(config.defaultTimeFrame);
  const [scaleSpeed, setScaleSpeed] = useState(config.defaultScaleSpeed);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Basic revenue trend logic
  let revenueTrend = [];
  let cumulativeRevenue = 0;
  let breakEvenMonth = null;
  const speedFactor = scaleSpeed === "fast" ? 1.2 : scaleSpeed === "slow" ? 0.8 : 1.0;

  for (let month = 1; month <= timeFrame; month++) {
    const monthlyRevenue = pricing * month * speedFactor;
    cumulativeRevenue += monthlyRevenue;
    revenueTrend.push(cumulativeRevenue);
    if (!breakEvenMonth && cumulativeRevenue >= initialInvestment) {
      breakEvenMonth = month;
    }
  }

  // Define chart data with a thicker regal blue line
  const data = {
    labels: Array.from({ length: timeFrame }, (_, i) => `Month ${i + 1}`),
    datasets: [
      {
        label: "Cumulative Revenue ($)",
        data: revenueTrend,
        borderColor: '#3F51B5',
        borderWidth: 4,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        ticks: {
          color: '#000000',
          callback: (value) => `$${value}`,
        },
      },
      x: {
        ticks: { color: '#000000' },
      },
    },
  };

  // Advanced features drawer content (placeholder)
  const advancedContent = (
    <Box sx={{ p: 2, width: 300 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
        Advanced Features
      </Typography>
      <Typography>
        Placeholder for advanced settings and integrations.
      </Typography>
      <Button variant="contained" onClick={() => setAdvancedOpen(false)} sx={{ mt: 2 }}>
        Close
      </Button>
    </Box>
  );

  // Advanced tab that toggles the drawer with smooth animation
  const advancedTab = (
    <Box
      onClick={() => setAdvancedOpen(!advancedOpen)}
      sx={{
        position: 'fixed',
        top: 20,
        left: advancedOpen ? 300 : 0,
        backgroundColor: '#3F51B5',
        color: '#ffffff',
        padding: '8px 16px',
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        cursor: 'pointer',
        zIndex: 1300,
        boxShadow: 3,
        transition: 'left 0.3s ease-in-out',
      }}
    >
      Advanced Features
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      {advancedTab}
      <Drawer
        anchor="left"
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        transitionDuration={300}
        sx={{
          '& .MuiDrawer-paper': {
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            background: '#ffffff',
            color: '#000000',
          },
        }}
      >
        {advancedContent}
      </Drawer>
      <Container
        maxWidth="md"
        sx={{
          py: 4,
          background: 'linear-gradient(135deg, #e0e0e0, #f5f5f5)',
          minHeight: '100vh',
        }}
      >
        <Paper sx={{ p: 4, borderRadius: 4, boxShadow: 3 }}>
          <Typography variant="h4" align="center" gutterBottom>
            {config.title}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography>Pricing ($ per unit): {pricing}</Typography>
              <Slider
                sx={sliderSx}
                value={pricing}
                onChange={(e, val) => setPricing(val)}
                min={50}
                max={1000}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography>Initial Investment ($): {initialInvestment}</Typography>
              <Slider
                sx={sliderSx}
                value={initialInvestment}
                onChange={(e, val) => setInitialInvestment(val)}
                min={1000}
                max={50000}
                step={500}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography>Time Frame (months): {timeFrame}</Typography>
              <Slider
                sx={sliderSx}
                value={timeFrame}
                onChange={(e, val) => setTimeFrame(val)}
                min={3}
                max={36}
                step={1}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography>Scale Speed: {scaleSpeed}</Typography>
              <Slider
                sx={sliderSx}
                value={scaleSpeed === "slow" ? 0 : scaleSpeed === "medium" ? 1 : 2}
                onChange={(e, val) => {
                  const speeds = ["slow", "medium", "fast"];
                  setScaleSpeed(speeds[val]);
                }}
                min={0}
                max={2}
                step={1}
                valueLabelDisplay="auto"
                marks={[
                  { value: 0, label: "Slow" },
                  { value: 1, label: "Medium" },
                  { value: 2, label: "Fast" },
                ]}
              />
            </Grid>
          </Grid>
          <Box sx={{ height: 300, mt: 4 }}>
            <Chart type="line" data={data} options={options} />
          </Box>
          <Card sx={{ mt: 4, p: 2, borderRadius: 4, boxShadow: '0px 2px 8px rgba(0,0,0,0.2)' }}>
            <CardHeader title="Break-Even Analysis" />
            <CardContent>
              {breakEvenMonth ? (
                <Typography>
                  Break-even reached at month {breakEvenMonth}.
                </Typography>
              ) : (
                <Typography>
                  Break-even not reached within {timeFrame} months.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default ROICalculatorWhiteLabel;
