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
// import logo from './assets/ace-coatings-logo.png'; // Uncomment if using a local logo

/* ------------------ Chart.js Registration ------------------ */
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

/* ------------------ Helper: Interpolate Line ------------------ */
function interpolateLine(lineData, fraction) {
  if (!lineData.length) return 0;
  if (fraction <= lineData[0].x) return lineData[0].y;
  if (fraction >= lineData[lineData.length - 1].x) {
    return lineData[lineData.length - 1].y;
  }
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

/* ------------------ ACE Config & Constants ------------------ */
const aceConfig = {
  title: 'Ace Coatings ROI Calculator',
  baseJobsPerWeek: 2, // 2 jobs per week per crew
};

const grossRevenuePerJob = 6250;
const averageCostPerJob = 2400;
const netRevenuePerJob = grossRevenuePerJob - averageCostPerJob; // 6250 - 2400 = 3850
const depositPerJob = grossRevenuePerJob * 0.5; // 3125
const totalStartupCost = 15000;
const FINAL_PAYMENT_DELAY = 42; // days

/* ------------------ Ad Spend Mapping ------------------ */
const adSpendMapping = {
  AllIn: { label: 'All-In ($75/day)', daily: 75 },
  DoubleDown: { label: 'Double Down ($50/day)', daily: 50 },
  PlayItSafe: { label: 'Play it Safe ($30/day)', daily: 30 },
};

/* ------------------ MUI Theme ------------------ */
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

/* ------------------ Booking Tag Plugin ------------------ */
const bookingTagPlugin = {
  id: 'bookingTagPlugin',
  afterDatasetsDraw(chart) {
    const {
      ctx,
      scales: { x: xScale, y: yScale },
    } = chart;
    chart.data.datasets.forEach((ds) => {
      if (ds.label === 'Booking Targets') {
        ds.data.forEach((point) => {
          const xPixel = xScale.getPixelForValue(point.x);
          const yPixel = yScale.getPixelForValue(point.y);
          const tagText = point.customLabel;
          ctx.save();
          ctx.fillStyle = 'white';
          ctx.strokeStyle = '#0D47A1';
          ctx.lineWidth = 1;
          ctx.font = 'bold 12px Roboto';
          const textWidth = ctx.measureText(tagText).width;
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
          ctx.fillText(tagText, xPixel, rectY + rectHeight / 2);
          ctx.restore();
        });
      }
    });
  },
};

/* ------------------ Helper: Round to Nearest 0.5 ------------------ */
function roundToNearestHalf(num) {
  const fractional = num - Math.floor(num);
  if (fractional <= 0.55) {
    return Math.floor(num) + 0.5;
  } else {
    return Math.ceil(num);
  }
}

export default function AceCoatingsROICalculator() {
  // Inputs and state
  const [zipCode, setZipCode] = useState('');
  const [adSpendOption, setAdSpendOption] = useState('DoubleDown');
  const [timeFrame, setTimeFrame] = useState(3); // Default 3 months
  // We'll use crewAdditions array to store the day (number) each new crew is added.
  const [crewAdditions, setCrewAdditions] = useState([]);
  const [showTargets, setShowTargets] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [openEmailForm, setOpenEmailForm] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);

  // Effective crew count on a given day is calculated per day, but here for UI display we assume current effective count is:
  const effectiveCrewCount = Math.min(1 + crewAdditions.length, 4);

  const baseDailyAdSpend = adSpendMapping[adSpendOption]?.daily || 0;

  // ---- Partial Timeline Revenue Simulation ----
  // We'll build the dayData array day-by-day, calculating crew count for each day.
  const totalDays = timeFrame * 30;
  let cumulative = 0;
  const dayData = [];
  for (let day = 1; day <= totalDays; day++) {
    // Calculate the crew count for this day based on crewAdditions that have occurred on or before this day.
    const currentCrewCount = Math.min(
      1 + crewAdditions.filter((d) => d <= day).length,
      4
    );
    // Daily capacity based on current crew count
    const dailyCapacity =
      (currentCrewCount * aceConfig.baseJobsPerWeek * 4.3) / 30;
    // Daily ad spend is applied per crew (each crew gets its own ad spend)
    const dailyAdSpend = baseDailyAdSpend * currentCrewCount;
    // Daily appointments depend on daily ad spend
    const dailyAppointments = (dailyAdSpend / 36) * 0.5;
    const jobsDone = Math.min(dailyCapacity, dailyAppointments);
    const depositRevenue = jobsDone * depositPerJob;
    let finalPaymentRevenue = 0;
    if (day > FINAL_PAYMENT_DELAY) {
      finalPaymentRevenue = jobsDone * (netRevenuePerJob - depositPerJob);
    }
    let dailyProfit = depositRevenue + finalPaymentRevenue - dailyAdSpend - 20;
    if (day === 1) {
      dailyProfit -= totalStartupCost;
    }
    cumulative += dailyProfit;
    dayData.push({ x: day / 30, y: cumulative });
  }
  // --------------------------------------------------

  // Break-Even Calculation: First day where cumulative >= 0 (with interpolation)
  let breakEvenDay = null;
  for (let i = 0; i < dayData.length; i++) {
    if (dayData[i].y >= 0) {
      breakEvenDay = i + 1;
      break;
    }
  }
  let breakEvenWeeks = 0;
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
    breakEvenWeeks = exactBreakEvenDay / 7;
  }
  const roundedBreakEven =
    breakEvenDay !== null ? roundToNearestHalf(breakEvenWeeks) : 'Not reached';
  const breakEvenDisplay =
    breakEvenDay !== null ? `${roundedBreakEven} weeks` : 'Not reached';

  // Booking Targets Logic:
  // When no additional crew has been added, thresholds are [8, 10, 12] weeks.
  // When one or more additional crews exist, thresholds are [4, 8, 10] weeks relative to the last crew addition.
  const currentThresholds = crewAdditions.length > 0 ? [4, 8, 10] : [8, 10, 12];
  function findThresholdDay(thresholdWeeks) {
    const baseline = crewAdditions.length > 0 ? Math.max(...crewAdditions) : 0;
    if (baseline > 0) {
      return baseline + thresholdWeeks * 7;
    } else {
      // With no additional crew, effective crew count is 1.
      const neededAppointments =
        thresholdWeeks * (1 * aceConfig.baseJobsPerWeek);
      if (baseDailyAdSpend <= 0) return totalDays;
      const dailyAppointments = (baseDailyAdSpend / 36) * 0.5;
      return neededAppointments / dailyAppointments;
    }
  }
  const bookingDots = [];
  if (showTargets) {
    currentThresholds.forEach((thr) => {
      let thresholdDay = findThresholdDay(thr);
      thresholdDay = Math.min(Math.max(thresholdDay, 1), totalDays);
      const xPos = thresholdDay / 30;
      const yPos = interpolateLine(dayData, xPos);
      const label =
        thr === currentThresholds[0]
          ? 'All-In'
          : thr === currentThresholds[1]
          ? 'Double Down'
          : 'Call';
      const color =
        thr === currentThresholds[0]
          ? 'red'
          : thr === currentThresholds[1]
          ? 'yellow'
          : 'green';
      bookingDots.push({
        x: xPos,
        y: yPos,
        customLabel: label,
        color: color,
        day: thresholdDay,
      });
    });
  }

  const monthlyMarkers = dayData.filter((_, idx) => (idx + 1) % 30 === 0);

  // Chart Data & Options
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
    data: monthlyMarkers,
    pointRadius: 6,
    pointBackgroundColor: '#0D47A1',
    pointBorderColor: '#FFFFFF',
    pointBorderWidth: 2,
    order: 2,
    z: 2,
  };
  const bookingTargetDataset = {
    type: 'scatter',
    label: 'Booking Targets',
    data: bookingDots,
    pointRadius: 10,
    pointBorderColor: '#0D47A1',
    pointBorderWidth: 2,
    pointBackgroundColor: (ctx) => {
      const idx = ctx.dataIndex;
      const color = bookingDots[idx]?.color;
      if (color === 'red') return 'rgba(255,0,0,0.8)';
      if (color === 'yellow') return 'rgba(255,235,59,0.8)';
      if (color === 'green') return 'rgba(0,255,0,0.8)';
      return 'rgba(0,0,0,0.8)';
    },
    order: 1,
    z: 3,
  };
  const chartData = {
    datasets: [lineDataset, monthlyMarkerDataset, bookingTargetDataset],
  };

  // Disable tooltip for the revenue line
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        filter: (tooltipItem) =>
          tooltipItem.dataset.label !== 'Cumulative Revenue ($)',
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            });
            if (ctx.dataset.label === 'Booking Targets') {
              return `Click to add crew → $${val}`;
            }
            if (ctx.dataset.label === 'Monthly Markers') {
              return `Month ${ctx.parsed.x.toFixed(1)}: $${val}`;
            }
            return `$${val}`;
          },
        },
      },
      bookingTagPlugin,
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: timeFrame,
        title: { display: true, text: 'Months' },
        ticks: { color: '#0D47A1', stepSize: 1 },
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
      if (elements.length > 0) {
        const element = elements[0];
        const dsLabel = chartData.datasets[element.datasetIndex].label;
        if (dsLabel === 'Booking Targets') {
          const idx = element.index;
          const targetDot = bookingDots[idx];
          if (targetDot) {
            // Immediately add a crew at the clicked dot's day.
            handleAddCrewFromBookingTarget(targetDot.day);
          }
        }
      }
    },
  };

  let monthlyNetRevenueLast30 = 0;
  if (dayData.length > 30) {
    const finalCumulative = dayData[dayData.length - 1].y;
    const startCumulative = dayData[dayData.length - 31].y;
    monthlyNetRevenueLast30 = finalCumulative - startCumulative;
  } else {
    monthlyNetRevenueLast30 = dayData.length
      ? dayData[dayData.length - 1].y
      : 0;
  }
  const monthlyNetRevenueDisplay = monthlyNetRevenueLast30.toLocaleString(
    undefined,
    { maximumFractionDigits: 0 }
  );
  let yearlyNetRevenue = 0;
  if (timeFrame >= 12) {
    const dayIndex = 12 * 30 - 1;
    yearlyNetRevenue =
      dayIndex < dayData.length
        ? dayData[dayIndex].y
        : dayData[dayData.length - 1].y;
  } else {
    const finalVal = dayData[dayData.length - 1]?.y || 0;
    yearlyNetRevenue = (finalVal / timeFrame) * 12;
  }
  const yearlyNetRevenueDisplay = yearlyNetRevenue.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  // Chart expansion functions
  function handleExpandChart() {
    setChartExpanded(true);
  }
  function handleCloseExpand() {
    setChartExpanded(false);
  }
  function handleResetChart() {
    setZipCode('');
    setCrewAdditions([]); // resets effective crew count to 1
    setAdSpendOption('PlayItSafe');
    setTimeFrame(3);
    setShowTargets(true);
    setToastMessage('Chart reset to default conservative settings.');
    setTimeout(() => setToastMessage(''), 3000);
  }

  // Crew addition from booking dot
  function handleAddCrewFromBookingTarget(eventDay) {
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
    <ThemeProvider theme={theme}>
      <Container
        maxWidth='lg'
        sx={{
          py: 6,
          px: { xs: 2, md: 4 },
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, boxShadow: 3 }}>
          <Grid container spacing={3}>
            {/* LEFT PANEL */}
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
                    color: theme.palette.text.primary,
                    mb: 3,
                  }}
                >
                  Ace Coatings ROI Calculator
                </Typography>
                {/* Zip Code Input with info tag */}
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 'bold', color: '#424242' }}
                >
                  Zip Code
                </Typography>
                <TextField
                  variant='outlined'
                  size='small'
                  fullWidth
                  type='number'
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Typography
                  variant='caption'
                  sx={{ display: 'block', color: '#757575', mb: 2 }}
                >
                  Enter your zip code to get a projection based on your workable
                  months. Outdoor temperature is crucial for product setting.
                </Typography>

                {/* Daily Ad Spend Input with info tag */}
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
                  This assumes a 50% close rate of inbound leads. The more you
                  spend on ads, the more likely leads you will have to close and
                  book.
                </Typography>

                {/* Time Frame Input with plus/minus */}
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

                {/* Crew Count with plus/minus using booking dot logic */}
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
                      if (bookingDots.length > 0) {
                        // Add a crew at the conservative booking dot (first dot)
                        handleAddCrewFromBookingTarget(bookingDots[0].day);
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

                {/* Hide Booking Targets Button */}
                <Button
                  variant='outlined'
                  fullWidth
                  onClick={() => setShowTargets(!showTargets)}
                  sx={{
                    mb: 2,
                    borderWidth: '2px',
                    borderColor: '#0D47A1',
                    color: '#0D47A1',
                    fontWeight: 'bold',
                    '&:hover': {
                      borderWidth: '2px',
                      borderColor: '#0D47A1',
                      backgroundColor: '#E3F2FD',
                    },
                  }}
                >
                  {showTargets
                    ? 'Hide Booking Targets'
                    : 'Show Booking Targets'}
                </Button>
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

            {/* RIGHT PANEL */}
            <Grid item xs={12} md={8}>
              {/* Revenue Headers – responsive wrapping to keep in view */}
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
                    sx={{ fontWeight: 400, color: theme.palette.text.primary }}
                  >
                    ${yearlyNetRevenueDisplay}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ fontWeight: 400 }}>
                    Yearly Revenue
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant='h3'
                    sx={{ fontWeight: 400, color: theme.palette.text.primary }}
                  >
                    ${monthlyNetRevenueDisplay}
                  </Typography>
                  <Typography variant='subtitle1' sx={{ fontWeight: 400 }}>
                    Monthly Revenue
                  </Typography>
                </Box>
              </Box>

              {/* Chart */}
              <Box
                sx={{
                  width: '100%',
                  height: { xs: 300, md: 400 },
                  position: 'relative',
                }}
              >
                <Chart type='line' data={chartData} options={chartOptions} />
              </Box>

              {/* Buttons Under Chart */}
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

          {/* LOWER UI ROW: ROI Break Even & Per Job Stats */}
          <Box sx={{ mt: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
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
                  <Typography
                    variant='caption'
                    sx={{ display: 'block', color: '#757575', mt: 1 }}
                  >
                    The break even point considers the one time license fee and
                    initial equipment costs. Jump on a call to get a pricing
                    breakdown based on your area.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
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
            </Grid>
          </Box>

          {/* "How We Calculate Revenue" Accordion with thicker border */}
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
                  upfront and the final net payment is received after a 42-day
                  delay.
                  <br />
                  <strong>Break-Even:</strong> The point where cumulative cash
                  flow first reaches $0.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>

          {/* Disclaimer */}
          <Box sx={{ mt: 4, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
            <Typography variant='subtitle2' sx={{ fontStyle: 'italic' }}>
              <strong>Disclaimer:</strong> The results shown are estimates only
              and do not guarantee future revenue. Ace Coatings is not liable
              for any decisions made based on these projections. Actual results
              may vary.
            </Typography>
          </Box>
        </Paper>

        {/* Toast Notification */}
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

        {/* Expand Chart Dialog */}
        <Dialog
          open={chartExpanded}
          onClose={handleCloseExpand}
          fullWidth
          maxWidth='xl'
        >
          <DialogContent>
            <Box sx={{ width: '100%', height: '80vh' }}>
              <Chart type='line' data={chartData} options={chartOptions} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseExpand} variant='outlined'>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Email Projections Modal */}
        <EmailProjectionsFormTailwind
          open={openEmailForm}
          onClose={() => setOpenEmailForm(false)}
          projectionsHtml={`
            <h1>Your ROI Projections</h1>
            <p><strong>Zip Code:</strong> ${zipCode}</p>
            <p><strong>Ad Spend:</strong> ${
              adSpendMapping[adSpendOption]?.label
            }</p>
            <p><strong>Time Frame:</strong> ${timeFrame} months</p>
            <p><strong>Crew Count:</strong> ${1 + crewAdditions.length}</p>
            <p><strong>Monthly Revenue:</strong> $${monthlyNetRevenueDisplay}</p>
            <p><strong>Yearly Revenue:</strong> $${yearlyNetRevenueDisplay}</p>
            <p><strong>Break-Even:</strong> ${breakEvenDisplay}</p>
            <p><strong>Net Revenue per Job:</strong> $${netRevenuePerJob.toFixed(
              2
            )}</p>
            <p><strong>Gross Revenue per Job:</strong> $${grossRevenuePerJob.toFixed(
              2
            )}</p>
            <p><strong>Daily Ad Spend Setting:</strong> $${baseDailyAdSpend} per crew</p>
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
