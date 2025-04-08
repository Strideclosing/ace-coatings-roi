// AceCoatingsROICalculator.js

import React, { useState } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  LineController,
  ScatterController,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  Typography,
  Container,
  Paper,
  Grid,
  Box,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import EmailProjectionsFormTailwind from './EmailProjectionsFormTailwind';
import stateWorkabilityData from './State based temps/state_workability_data_FINAL_FULL.json';
// import logo from './assets/ace-coatings-logo.png'; // Uncomment if needed

// ------------------ Global Constants ------------------
const aceConfig = {
  title: 'Ace Coatings ROI Calculator',
  baseJobsPerWeek: 2,
};
const grossRevenuePerJob = 6250;
const averageCostPerJob = 2400;
const netRevenuePerJob = grossRevenuePerJob - averageCostPerJob;
const depositPerJob = grossRevenuePerJob * 0.5;
const totalStartupCost = 15000;

const aggressionSettings = {
  Aggressive: {
    thresholdJobs: 8,
    payoutDelay: 28,
    dotColor: 'rgba(255,0,0,0.8)',
  },
  Moderate: {
    thresholdJobs: 12,
    payoutDelay: 42,
    dotColor: 'rgba(255,235,59,0.8)',
  },
  Conservative: {
    thresholdJobs: 20,
    payoutDelay: 70,
    dotColor: 'rgba(0,255,0,0.8)',
  },
};

const adSpendMapping = {
  AllIn: { label: 'All-In ($75/day)', daily: 75 },
  DoubleDown: { label: 'Double Down ($50/day)', daily: 50 },
  PlayItSafe: { label: 'Play it Safe ($30/day)', daily: 30 },
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2196F3' },
    text: { primary: '#757575' },
    background: { default: '#ffffff', paper: '#ffffff' },
  },
  typography: {
    fontFamily: "'Roboto', sans-serif",
    h4: { fontWeight: 700 },
  },
});

// ------------------ Global Helper Functions ------------------
function interpolateLine(lineData, fraction) {
  if (!lineData.length) return 0;
  if (fraction <= lineData[0].x) return lineData[0].y;
  if (fraction >= lineData[lineData.length - 1].x)
    return lineData[lineData.length - 1].y;
  for (let i = 1; i < lineData.length; i++) {
    if (fraction <= lineData[i].x) {
      const start = lineData[i - 1];
      const end = lineData[i];
      const d = (fraction - start.x) / (end.x - start.x);
      return start.y + d * (end.y - start.y);
    }
  }
  return lineData[lineData.length - 1].y;
}

function roundToNearestHalf(num) {
  const fractional = num - Math.floor(num);
  return fractional <= 0.55 ? Math.floor(num) + 0.5 : Math.ceil(num);
}

// ------------------ Global Styles ------------------
const pulseKeyframes = `
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(33,150,243,0.7); }
  70% { box-shadow: 0 0 0 10px rgba(33,150,243,0); }
  100% { box-shadow: 0 0 0 0 rgba(33,150,243,0); }
}
`;
const GlobalStyles = () => <style>{pulseKeyframes}</style>;

// ------------------ Chart Plugins ------------------

// Remove the bracketLinePlugin visual drawing for green brackets.
// We still keep the underlying logic (if any) in your simulation calculations,
// but visually, we are no longer drawing the bracket.

// Booking Tag Plugin: Draws the active dot label.
const bookingTagPlugin = {
  id: 'bookingTagPlugin',
  afterDatasetsDraw(chart) {
    const {
      ctx,
      scales: { x: xScale, y: yScale },
    } = chart;
    chart.data.datasets.forEach((ds) => {
      if (ds.label === 'Active Crew Dot') {
        ds.data.forEach((point) => {
          const xPixel = xScale.getPixelForValue(point.x);
          const yPixel = yScale.getPixelForValue(point.y);
          ctx.save();
          ctx.fillStyle = 'white';
          ctx.strokeStyle = '#0D47A1';
          ctx.lineWidth = 1;
          ctx.font = 'bold 12px Roboto';
          const textWidth = ctx.measureText(point.customLabel).width;
          const padding = 4;
          const rectWidth = textWidth + padding * 2;
          const rectHeight = 20;
          const rectX = xPixel - rectWidth / 2;
          const rectY = yPixel - rectHeight - 10;
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
          ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
          ctx.fillStyle = '#0D47A1';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(point.customLabel, xPixel, rectY + rectHeight / 2);
          ctx.restore();
        });
      }
    });
  },
};

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  bookingTagPlugin
  // Note: bracketLinePlugin removed from registration.
);

// ------------------ Main Component ------------------
export default function AceCoatingsROICalculator() {
  return (
    <>
      <GlobalStyles />
      <MainCalculator />
    </>
  );
}

function MainCalculator() {
  const localTheme = theme;

  // State for user inputs
  const [selectedState, setSelectedState] = useState('');
  const [adSpendOption, setAdSpendOption] = useState('PlayItSafe');
  const [timeFrame, setTimeFrame] = useState(6);
  const [aggressionLevel, setAggressionLevel] = useState('Conservative');
  const [crewAdditions, setCrewAdditions] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [openEmailForm, setOpenEmailForm] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const currentMonthIndex = new Date().getMonth();

  // Determine projection multiplier and label based on timeFrame.
  // Simulation always based on 12 months.
  let projectionMultiplier = 1;
  let projectionLabel = '1 Year Projection';
  if (timeFrame > 12 && timeFrame <= 24) {
    projectionMultiplier = 2;
    projectionLabel = '2 Year Projection';
  } else if (timeFrame > 24 && timeFrame <= 36) {
    projectionMultiplier = 3;
    projectionLabel = '3 Year Projection';
  }

  // Always simulate a fixed 12-month period (360 days).
  const simulationDays = 12 * 30;

  // Simulation & Dot Logic – run simulation if state is selected
  let dayData = [];
  let monthlyNetRevenueDisplay = '0';
  let yearlyNetRevenueDisplay = '0';
  let breakEvenDisplay = 'Not reached';
  let activeDotDataset = null;
  let monthlyMarkers = [];
  let totalWorkableWeeks = 0;

  if (selectedState) {
    const stateData = stateWorkabilityData[selectedState];
    const monthlyScoresRaw = stateData.monthly_scores;
    totalWorkableWeeks = stateData.total_workable_weeks;
    const baseDailyAdSpend = adSpendMapping[adSpendOption]?.daily || 0;

    let cumulative = 0;
    dayData = [];
    // Run simulation for a full 12 months irrespective of user-selected timeFrame.
    for (let day = 1; day <= simulationDays; day++) {
      const currentCrewCount = Math.min(
        1 + crewAdditions.filter((d) => d <= day).length,
        4
      );
      const rawMonthIndex = Math.floor((day - 1) / 30);
      const monthIndex = (currentMonthIndex + rawMonthIndex) % 12;
      const monthlyScore = monthlyScoresRaw[monthIndex];

      const dailyCapacity =
        (currentCrewCount * aceConfig.baseJobsPerWeek * 4.3) / 30;

      // Ad Spend Adjustment: apply thresholds.
      let adjustedDailyAdSpend = 0;
      if (monthlyScore < 0.3) {
        adjustedDailyAdSpend = 0;
      } else if (monthlyScore >= 0.3 && monthlyScore < 0.5) {
        const scale = (monthlyScore - 0.3) / (0.5 - 0.3);
        adjustedDailyAdSpend =
          baseDailyAdSpend * currentCrewCount * (scale * 0.5);
      } else {
        adjustedDailyAdSpend = baseDailyAdSpend * currentCrewCount;
      }

      const dailyAppointments = (adjustedDailyAdSpend / 36) * 0.5;
      const jobsDone = Math.min(dailyCapacity, dailyAppointments);
      const depositRevenue = jobsDone * depositPerJob;
      let finalPaymentRevenue = 0;
      if (day > aggressionSettings[aggressionLevel].payoutDelay) {
        finalPaymentRevenue = jobsDone * (netRevenuePerJob - depositPerJob);
      }
      const variableRevenue =
        (depositRevenue + finalPaymentRevenue) * monthlyScore;
      const adjustedAdSpend = adjustedDailyAdSpend * monthlyScore;
      let dailyProfit = variableRevenue - adjustedAdSpend - 20;
      if (day === 1) dailyProfit -= totalStartupCost;
      cumulative += dailyProfit;
      dayData.push({ x: day / 30, y: cumulative });
    }

    // Calculate Break-Even Point in weeks.
    let breakEvenDay = null;
    for (let i = 0; i < dayData.length; i++) {
      if (dayData[i].y >= 0) {
        breakEvenDay = i + 1;
        break;
      }
    }
    if (breakEvenDay !== null) {
      let exactBreakEvenDay = breakEvenDay;
      if (breakEvenDay > 1) {
        const prev = dayData[breakEvenDay - 2];
        const current = dayData[breakEvenDay - 1];
        if (current.y !== prev.y) {
          const fraction = (0 - prev.y) / (current.y - prev.y);
          exactBreakEvenDay = breakEvenDay - 1 + fraction;
        }
      }
      const breakEvenWeeks = exactBreakEvenDay / 7;
      breakEvenDisplay = `${roundToNearestHalf(breakEvenWeeks)} weeks`;
    }

    monthlyMarkers = dayData.filter((_, idx) => (idx + 1) % 30 === 0);

    // Revenue Calculations:
    // Base yearly revenue is the cumulative revenue of 12 months simulation.
    const baseYearlyRevenue = dayData[simulationDays - 1].y;
    // Apply projection multiplier if timeFrame > 12.
    const adjustedYearlyRevenue = baseYearlyRevenue * projectionMultiplier;
    yearlyNetRevenueDisplay = adjustedYearlyRevenue.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
    const adjustedMonthlyRevenue = adjustedYearlyRevenue / 12;
    monthlyNetRevenueDisplay = adjustedMonthlyRevenue.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 0,
      }
    );

    // Active Dot Logic: Based on the fixed simulation period.
    const lastCrewStart =
      crewAdditions.length > 0 ? Math.max(...crewAdditions) : 1;
    let cumulativeJobCount = 0;
    let activeDotDay = null;
    const thresholdJobs = aggressionSettings[aggressionLevel].thresholdJobs;
    for (let day = lastCrewStart; day <= simulationDays; day++) {
      const currentCrewCount = Math.min(
        1 + crewAdditions.filter((d) => d <= day).length,
        4
      );
      const rawMonthIndex = Math.floor((day - 1) / 30);
      const monthIndex = (currentMonthIndex + rawMonthIndex) % 12;
      const monthlyScore = monthlyScoresRaw[monthIndex];
      const dailyCapacity =
        (currentCrewCount * aceConfig.baseJobsPerWeek * 4.3) / 30;
      let adjustedDailyAdSpendForDot = 0;
      if (monthlyScore < 0.3) {
        adjustedDailyAdSpendForDot = 0;
      } else if (monthlyScore >= 0.3 && monthlyScore < 0.5) {
        const scale = (monthlyScore - 0.3) / (0.5 - 0.3);
        adjustedDailyAdSpendForDot =
          baseDailyAdSpend * currentCrewCount * (scale * 0.5);
      } else {
        adjustedDailyAdSpendForDot = baseDailyAdSpend * currentCrewCount;
      }
      const dailyAppointments = (adjustedDailyAdSpendForDot / 36) * 0.5;
      const jobsDone = Math.min(dailyCapacity, dailyAppointments);
      cumulativeJobCount += jobsDone / currentCrewCount;
      if (!activeDotDay && cumulativeJobCount >= thresholdJobs) {
        activeDotDay = day;
        break;
      }
    }
    if (!activeDotDay) activeDotDay = simulationDays;
    const dotX = activeDotDay / 30;
    const dotY = interpolateLine(dayData, dotX);
    activeDotDataset = {
      type: 'scatter',
      label: 'Active Crew Dot',
      data: [{ x: dotX, y: dotY, customLabel: 'Add Crew' }],
      pointRadius: 10,
      backgroundColor: aggressionSettings[aggressionLevel].dotColor,
      borderColor: '#0D47A1',
      borderWidth: 2,
      order: 999,
      z: 999,
    };
  }

  // Chart datasets
  const lineDataset = {
    type: 'line',
    label: 'Cumulative Revenue ($)',
    data: dayData,
    borderColor: '#0D47A1',
    borderWidth: 4,
    borderDash: [7, 5],
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 6,
    order: 2,
    z: 2,
  };

  const monthlyMarkerDataset = {
    type: 'scatter',
    label: 'Monthly Markers',
    data: dayData.filter((_, idx) => (idx + 1) % 30 === 0),
    pointRadius: 6,
    pointBackgroundColor: '#0D47A1',
    pointBorderColor: '#FFFFFF',
    pointBorderWidth: 2,
    order: 3,
    z: 3,
  };

  const datasets = [lineDataset, monthlyMarkerDataset];
  if (activeDotDataset) datasets.push(activeDotDataset);
  const chartData = { datasets };

  // Unique key for chart remounting when inputs change.
  const chartKey = `${selectedState}-${adSpendOption}-${timeFrame}-${aggressionLevel}-${crewAdditions.length}`;

  const chartOptions = {
    animation: {
      duration: 1000,
      easing: 'easeOutCubic',
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        filter: (tooltipItem) =>
          tooltipItem.dataset.label !== 'Cumulative Revenue ($)',
        callbacks: {
          label: (ctx) => {
            const val =
              ctx.parsed.y?.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              }) || '0';
            if (ctx.dataset.label === 'Active Crew Dot') {
              return `Click to add crew → $${val}`;
            }
            if (ctx.dataset.label === 'Monthly Markers') {
              const offset = Math.round(ctx.parsed.x);
              const cycIndex = (currentMonthIndex + offset) % 12;
              return `Month ${monthNames[cycIndex]}: $${val}`;
            }
            return `$${val}`;
          },
        },
      },
      // Removed bracketLinePlugin from chart options.
      bookingTagPlugin: {},
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: timeFrame,
        title: { display: true, text: 'Months' },
        ticks: {
          stepSize: 1,
          color: '#0D47A1',
          callback: function (value) {
            const offset = Math.round(value);
            const cycIndex = (currentMonthIndex + offset) % 12;
            return monthNames[cycIndex];
          },
        },
      },
      y: {
        title: { display: true, text: 'Cumulative Revenue ($)' },
        ticks: {
          color: '#0D47A1',
          callback: (val) =>
            `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
    onClick: (evt, elements) => {
      if (elements.length > 0 && activeDotDataset) {
        const element = elements[0];
        if (
          chartData.datasets[element.datasetIndex].label === 'Active Crew Dot'
        ) {
          handleAddCrewFromBookingTarget(activeDotDataset.data[0].x * 30);
        }
      }
    },
  };

  function handleExpandChart() {
    setChartExpanded(true);
  }
  function handleCloseExpand() {
    setChartExpanded(false);
  }
  function handleResetChart() {
    setAdSpendOption('PlayItSafe');
    setTimeFrame(6);
    setCrewAdditions([]);
    setToastMessage('Chart reset to default conservative settings.');
    setTimeout(() => setToastMessage(''), 3000);
  }
  function handleAddCrewFromBookingTarget(eventDay) {
    const effectiveCrewCount = Math.min(1 + crewAdditions.length, 4);
    if (effectiveCrewCount < 4) {
      setCrewAdditions([...crewAdditions, eventDay]);
      setToastMessage(
        `Crew added at week ${Math.round(eventDay / 7)}! Now using ${
          effectiveCrewCount + 1
        } crews.`
      );
      setTimeout(() => setToastMessage(''), 3000);
    } else {
      setToastMessage('Maximum crews reached.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  }

  return (
    <ThemeProvider theme={localTheme}>
      <Container
        maxWidth='lg'
        sx={{
          py: 6,
          px: { xs: 2, md: 4 },
          backgroundColor: localTheme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, boxShadow: 3 }}>
          <Grid container spacing={3}>
            {/* LEFT PANEL: Inputs */}
            <Grid
              item
              xs={12}
              md={4}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <Box>
                <Typography
                  variant='h4'
                  sx={{
                    fontWeight: 'bold',
                    color: localTheme.palette.text.primary,
                    mb: 3,
                  }}
                >
                  Ace Coatings ROI Calculator
                </Typography>
                {/* State Dropdown */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  State
                </Typography>
                <FormControl
                  variant='outlined'
                  fullWidth
                  size='small'
                  sx={{
                    mb: 2,
                    animation:
                      selectedState === '' ? 'pulse 1s infinite' : 'none',
                  }}
                >
                  <Select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <MenuItem value=''>
                      <em>Select State</em>
                    </MenuItem>
                    {Object.keys(stateWorkabilityData).map((state) => (
                      <MenuItem key={state} value={state}>
                        {state}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {/* Daily Ad Spend */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  Daily Ad Spend
                </Typography>
                <FormControl
                  variant='outlined'
                  fullWidth
                  size='small'
                  sx={{ mb: 1 }}
                >
                  <Select
                    value={adSpendOption}
                    onChange={(e) => setAdSpendOption(e.target.value)}
                  >
                    <MenuItem value='AllIn'>
                      {adSpendMapping.AllIn.label}
                    </MenuItem>
                    <MenuItem value='DoubleDown'>
                      {adSpendMapping.DoubleDown.label}
                    </MenuItem>
                    <MenuItem value='PlayItSafe'>
                      {adSpendMapping.PlayItSafe.label}
                    </MenuItem>
                  </Select>
                </FormControl>
                <Typography
                  variant='caption'
                  sx={{ display: 'block', color: '#757575', mb: 2 }}
                >
                  This assumes a 50% close rate of inbound leads.
                </Typography>
                {/* Time Frame */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  Time Frame (Months)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TextField
                    variant='outlined'
                    size='small'
                    fullWidth
                    type='number'
                    value={timeFrame}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setTimeFrame(val > 0 ? (val > 36 ? 36 : val) : 1);
                    }}
                  />
                  <Button
                    variant='contained'
                    size='small'
                    sx={{ ml: 1 }}
                    onClick={() =>
                      setTimeFrame((prev) => (prev < 36 ? prev + 1 : 36))
                    }
                  >
                    +
                  </Button>
                  <Button
                    variant='contained'
                    color='error'
                    size='small'
                    sx={{ ml: 1 }}
                    onClick={() =>
                      setTimeFrame((prev) => (prev > 1 ? prev - 1 : 1))
                    }
                  >
                    –
                  </Button>
                </Box>
                {/* Aggression Level Selector */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  How are you planning to scale?
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant={
                      aggressionLevel === 'Aggressive'
                        ? 'contained'
                        : 'outlined'
                    }
                    onClick={() => setAggressionLevel('Aggressive')}
                  >
                    Aggressive
                  </Button>
                  <Button
                    variant={
                      aggressionLevel === 'Moderate' ? 'contained' : 'outlined'
                    }
                    onClick={() => setAggressionLevel('Moderate')}
                  >
                    Moderate
                  </Button>
                  <Button
                    variant={
                      aggressionLevel === 'Conservative'
                        ? 'contained'
                        : 'outlined'
                    }
                    onClick={() => setAggressionLevel('Conservative')}
                  >
                    Conservative
                  </Button>
                </Box>
                {/* Crew Count */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  Crew Count
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TextField
                    variant='outlined'
                    size='small'
                    fullWidth
                    type='number'
                    value={1 + crewAdditions.length}
                    InputProps={{ readOnly: true }}
                    sx={{ width: '60%' }}
                  />
                  <Button
                    variant='contained'
                    size='small'
                    sx={{ ml: 1 }}
                    onClick={() => {
                      if (activeDotDataset) {
                        handleAddCrewFromBookingTarget(
                          activeDotDataset.data[0].x * 30
                        );
                      }
                    }}
                  >
                    +
                  </Button>
                  <Button
                    variant='contained'
                    color='error'
                    size='small'
                    sx={{ ml: 1 }}
                    onClick={() => {
                      if (crewAdditions.length > 0) {
                        const newCrewAdditions = [...crewAdditions];
                        newCrewAdditions.pop();
                        setCrewAdditions(newCrewAdditions);
                        setToastMessage(
                          `Removed the last crew. Now using ${
                            1 + newCrewAdditions.length
                          } crew(s).`
                        );
                        setTimeout(() => setToastMessage(''), 3000);
                      } else {
                        setToastMessage('No additional crews to remove.');
                        setTimeout(() => setToastMessage(''), 3000);
                      }
                    }}
                  >
                    –
                  </Button>
                </Box>
              </Box>
              <Box>
                <Button
                  variant='contained'
                  fullWidth
                  sx={{
                    backgroundColor: '#FF6B00',
                    '&:hover': { backgroundColor: '#E65C00' },
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                  }}
                  onClick={() => setOpenEmailForm(true)}
                >
                  Email Me My Projections
                </Button>
              </Box>
            </Grid>

            {/* RIGHT PANEL: Revenue & Chart */}
            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: { xs: 2, sm: 6 },
                  ml: { xs: 1, sm: 3 },
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    variant='h3'
                    sx={{
                      fontWeight: 400,
                      color: localTheme.palette.text.primary,
                    }}
                  >
                    ${yearlyNetRevenueDisplay}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                    Yearly Revenue – {projectionLabel}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant='h3'
                    sx={{
                      fontWeight: 400,
                      color: localTheme.palette.text.primary,
                    }}
                  >
                    ${monthlyNetRevenueDisplay}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                    Average Monthly Revenue – {projectionLabel}
                  </Typography>
                </Box>
              </Box>

              {!selectedState ? (
                <Box
                  sx={{
                    width: '100%',
                    height: { xs: 300, md: 400 },
                    border: '1px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant='h4' color='error'>
                    SELECT STATE
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: { xs: 300, md: 400 },
                    position: 'relative',
                  }}
                >
                  <Chart
                    key={chartKey}
                    type='line'
                    data={chartData}
                    options={chartOptions}
                  />
                </Box>
              )}

              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Button
                  variant='contained'
                  color='info'
                  onClick={handleExpandChart}
                >
                  Expand Chart
                </Button>
                <Button
                  variant='contained'
                  color='primary'
                  sx={{ fontWeight: 'bold', px: 3 }}
                  onClick={handleResetChart}
                >
                  Reset Chart
                </Button>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 1 }}>
                    ROI Break Even Point
                  </Typography>
                  <Typography variant='h4' sx={{ fontWeight: 400 }}>
                    {breakEvenDisplay}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 1 }}>
                    Per Job Stats
                  </Typography>
                  <Typography variant='subtitle1' sx={{ mb: 1 }}>
                    <strong>Avg Jobs/Week/Crew:</strong>{' '}
                    {aceConfig.baseJobsPerWeek}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ mb: 1 }}>
                    <strong>Gross Revenue per Job:</strong> $
                    {grossRevenuePerJob.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ mb: 1 }}>
                    <strong>Net Revenue per Job:</strong> $
                    {netRevenuePerJob.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 1 }}>
                    Workable Weeks
                  </Typography>
                  <Typography variant='h4' sx={{ fontWeight: 400 }}>
                    {selectedState
                      ? stateWorkabilityData[selectedState].total_workable_weeks
                      : 0}{' '}
                    weeks
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          <Box
            sx={{ border: '2px solid #0D47A1', borderRadius: 2, mt: 4, p: 1 }}
          >
            <Accordion
              sx={{
                boxShadow: 'none',
                border: 'none',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6' sx={{ color: '#424242' }}>
                  How We Calculate Revenue
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>
                  <strong>Ad Spend:</strong> We assume $1 spent yields ~0.5
                  leads per $36, adjusted for your daily budget.
                  <br />
                  <strong>Crew Capacity:</strong> Each crew can do 2 jobs per
                  week.
                  <br />
                  <strong>Deposit Logic:</strong> A 50% deposit is collected
                  upfront and the final net payment is received after a dynamic
                  delay based on your scaling aggression.
                  <br />
                  <strong>Break-Even:</strong> The point where cumulative cash
                  flow first reaches $0.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>

          <Box sx={{ mt: 4, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
            <Typography variant='subtitle2' sx={{ fontStyle: 'italic' }}>
              <strong>Disclaimer:</strong> The results shown are estimates only
              and do not guarantee future revenue. Actual results may vary.
            </Typography>
          </Box>
        </Paper>

        {toastMessage && (
          <Box
            sx={{
              position: 'fixed',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'white',
              px: 3,
              py: 2,
              boxShadow: 3,
              borderRadius: 2,
              zIndex: 9999,
            }}
          >
            <Typography>{toastMessage}</Typography>
          </Box>
        )}

        <Dialog
          open={chartExpanded}
          onClose={handleCloseExpand}
          fullWidth
          maxWidth='xl'
        >
          <DialogContent>
            <Box sx={{ width: '100%', height: '80vh' }}>
              <Chart
                key={chartKey}
                type='line'
                data={chartData}
                options={chartOptions}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseExpand} variant='outlined'>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <EmailProjectionsFormTailwind
          open={openEmailForm}
          onClose={() => setOpenEmailForm(false)}
          projectionsHtml={`
            <h1>Your ROI Projections - ${projectionLabel}</h1>
            <p><strong>State:</strong> ${selectedState}</p>
            <p><strong>Ad Spend:</strong> ${
              adSpendMapping[adSpendOption]?.label
            }</p>
            <p><strong>Time Frame:</strong> ${timeFrame} months</p>
            <p><strong>Crew Count:</strong> ${1 + crewAdditions.length}</p>
            <p><strong>Aggression Level:</strong> ${aggressionLevel} (Final payment after ${
            aggressionSettings[aggressionLevel].payoutDelay
          } days)</p>
            <p><strong>Average Monthly Revenue:</strong> $${monthlyNetRevenueDisplay}</p>
            <p><strong>Yearly Revenue:</strong> $${yearlyNetRevenueDisplay}</p>
            <p><strong>Break-Even:</strong> ${breakEvenDisplay}</p>
            <p><strong>Net Revenue per Job:</strong> $${netRevenuePerJob.toFixed(
              2
            )}</p>
            <p><strong>Gross Revenue per Job:</strong> $${grossRevenuePerJob.toFixed(
              2
            )}</p>
            <p><strong>Total Workable Weeks:</strong> ${
              selectedState
                ? stateWorkabilityData[selectedState].total_workable_weeks
                : 0
            } weeks</p>
            <p><strong>Disclaimer:</strong> The results shown are estimates only and do not guarantee future revenue. Actual results may vary.</p>
          `}
          onSuccess={(bookAppointment) => {
            if (bookAppointment) {
              window.location.href =
                'https://calendly.com/licensing-acecoatingsutah/30min';
            }
          }}
        />
      </Container>
    </ThemeProvider>
  );
}
