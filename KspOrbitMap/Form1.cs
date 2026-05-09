using KRPC.Client;
using KRPC.Client.Services.SpaceCenter;

namespace KspOrbitMap;

public partial class Form1 : Form
{
    private Connection? connection;
    private Vessel? vessel;
    private Orbit? orbit;
    private Node? maneuverNode;
    private Orbit? postBurnOrbit;

    private System.Windows.Forms.Timer updateTimer;
    private Flight? flight, flightSurface;
    private KRPC.Client.Services.SpaceCenter.Control? _vesselControl;
    private KRPC.Client.Services.SpaceCenter.Control? vesselControl => _vesselControl ??= vessel?.Control;

    private bool isConnected, uiUpdating;
    private string? targetBodyName;
    private CelestialBody? targetBody;

    private PointF[] orbitPts = [];
    private PointF[] postPts = [];
    private PointF[] targetPts = [];
    private PointF vesselPos, apPos, pePos;
    private PointF nodePos, postApPos, postPePos;
    private float bodyR;
    private string bodyName = "";
    private float pxScale;
    private float cx, cy;
    private double timeToNode;

    private float zoom = 1f;
    private float panX, panY;
    private Point lastMouse;
    private bool panning, draggingNode, mouseOnNode;

    private struct SoiBody { public string Name; public PointF ScreenPos; public float SoiRadius; public float ScreenSoi; public bool Encounter; public double CloseApproach; }
    private List<SoiBody> soiBodies = [];

    private string encounterText = "";
    private int tickCount;

    public Form1()
    {
        InitializeComponent();
        updateTimer = new System.Windows.Forms.Timer { Interval = 200 };
        updateTimer.Tick += UpdateTimer_Tick;
    }

    private void BtnConnect_Click(object? sender, EventArgs e)
    {
        if (isConnected) { Disconnect(); return; }
        try
        {
            connection = new Connection("KspOrbitMap",
                System.Net.IPAddress.Parse("127.0.0.1"), 50000, 50001);
            var sc = connection.SpaceCenter();
            vessel = sc.ActiveVessel;
            orbit = vessel.Orbit;
            flight = vessel.Flight(orbit.Body.ReferenceFrame);
            flightSurface = vessel.Flight(vessel.SurfaceReferenceFrame);
            isConnected = true;
            lblStatus.Text = "● Conectado"; lblStatus.ForeColor = Color.Lime;
            btnConnect.Text = "Disconnect"; lblShip.Text = vessel.Name;
            cmbTarget.Items.Clear(); cmbTarget.Items.Add("(none)");
            foreach (var kv in sc.Bodies) cmbTarget.Items.Add(kv.Key);
            cmbTarget.SelectedIndex = 0;
            AutoFit();
            updateTimer.Start();
        }
        catch (Exception ex) { MessageBox.Show($"Erro: {ex.Message}"); Disconnect(); }
    }

    private void Disconnect()
    {
        updateTimer.Stop(); RemoveNode();
        if (isConnected) try { vesselControl!.Throttle = 0; } catch { }
        connection?.Dispose();
        connection = null; vessel = null; orbit = null;
        flight = null; flightSurface = null;
        maneuverNode = null; postBurnOrbit = null; _vesselControl = null;
        isConnected = false;
        lblStatus.Text = "● Desconectado"; lblStatus.ForeColor = Color.Red;
        btnConnect.Text = "Connect"; lblShip.Text = "";
        orbitPts = postPts = targetPts = [];
        soiBodies = [];
        orbitMap.Invalidate();
    }

    private void BtnSetTarget_Click(object? sender, EventArgs e)
    {
        if (!isConnected || connection == null) return;
        try
        {
            var sc = connection.SpaceCenter();
            if (cmbTarget.SelectedIndex <= 0) { sc.TargetBody = null; targetBodyName = null; targetBody = null; }
            else
            {
                var n = cmbTarget.SelectedItem?.ToString() ?? "";
                if (sc.Bodies.TryGetValue(n, out var b)) { sc.TargetBody = b; targetBodyName = n; targetBody = b; }
            }
        }
        catch { }
    }

    private void BtnFit_Click(object? sender, EventArgs e) => AutoFit();
    private void BtnResetView_Click(object? sender, EventArgs e) { zoom = 1; panX = 0; panY = 0; orbitMap.Invalidate(); }

    private void AutoFit()
    {
        if (orbit == null) return;
        panX = 0; panY = 0;
        double maxDist = Math.Max(orbit.Apoapsis, orbit.Periapsis);
        if (maxDist < bodyR * 3) maxDist = bodyR * 3;
        if (targetBody != null)
        {
            try
            {
                double td = Math.Max(targetBody.Orbit?.Apoapsis ?? 0, targetBody.Orbit?.Periapsis ?? 0);
                if (td > maxDist) maxDist = td;
            }
            catch { }
        }
        float drawR = Math.Min(orbitMap.Width, orbitMap.Height) * 0.42f;
        zoom = drawR / (float)maxDist;
        zoom = Math.Clamp(zoom, 0.05f, 100f);
        orbitMap.Invalidate();
    }

    private void UpdateTimer_Tick(object? sender, EventArgs e)
    {
        if (!isConnected || vessel == null) return;
        tickCount++;
        try { RefreshData(); UpdateMnuUI(); UpdateStatus(); orbitMap.Invalidate(); } catch { }
    }

    private void RefreshData()
    {
        if (orbit == null) return;
        double a = orbit.SemiMajorAxis, e = orbit.Eccentricity;
        double w = orbit.ArgumentOfPeriapsis;
        double nu = orbit.TrueAnomaly;
        bodyName = orbit.Body.Name;
        bodyR = (float)orbit.Body.EquatorialRadius;

        double maxDist = Math.Max(orbit.Apoapsis, orbit.Periapsis);
        if (maxDist < bodyR * 3) maxDist = bodyR * 3;
        if (targetBody != null) { double td = Math.Max(targetBody.Orbit?.Apoapsis ?? 0, targetBody.Orbit?.Periapsis ?? 0); if (td > maxDist) maxDist = td; }

        float drawR = Math.Min(orbitMap.Width, orbitMap.Height) * 0.42f;
        pxScale = drawR / (float)maxDist * zoom;
        cx = orbitMap.Width / 2f + panX;
        cy = orbitMap.Height / 2f + panY;

        int n = 96;
        orbitPts = MakeOrbit(a, e, w, n);

        double curR = a * (1 - e * e) / (1 + e * Math.Cos(nu));
        vesselPos = PeriToScreen(curR, nu, w);
        apPos = PeriToScreen(a * (1 + e), Math.PI, w);
        pePos = PeriToScreen(a * (1 - e), 0, w);

        if (maneuverNode != null)
        {
            postBurnOrbit = maneuverNode.Orbit;
            if (postBurnOrbit != null)
            {
                double pa = postBurnOrbit.SemiMajorAxis, pe = postBurnOrbit.Eccentricity, pw = postBurnOrbit.ArgumentOfPeriapsis;
                postPts = MakeOrbit(pa, pe, pw, n);
                postApPos = PeriToScreen(pa * (1 + pe), Math.PI, pw);
                postPePos = PeriToScreen(pa * (1 - pe), 0, pw);
            }
            double nuN = NodeTrueAnomaly(maneuverNode.UT, a, e, orbit.Epoch, nu);
            double rN = a * (1 - e * e) / (1 + e * Math.Cos(nuN));
            nodePos = PeriToScreen(rN, nuN, w);
            timeToNode = maneuverNode.UT - orbit.Epoch;
        }
        else { postPts = []; timeToNode = 0; }

        if (targetBodyName != null && targetBody != null && connection != null)
        {
            try
            {
                var to = connection.SpaceCenter().TargetBody?.Orbit;
                if (to != null) targetPts = MakeOrbit(to.SemiMajorAxis, to.Eccentricity, to.ArgumentOfPeriapsis, n);
                else targetPts = [];
            }
            catch { targetPts = []; }
        }
        else targetPts = [];

        if (tickCount % 5 == 0) ComputeSoiBodies(n);
    }

    private PointF[] MakeOrbit(double a, double e, double w, int n)
    {
        var pts = new PointF[n];
        for (int i = 0; i < n; i++)
        {
            double th = 2 * Math.PI * i / n;
            double r = a * (1 - e * e) / (1 + e * Math.Cos(th));
            if (r < 0) { pts[i] = PointF.Empty; continue; }
            pts[i] = PeriToScreen(r, th, w);
        }
        return pts;
    }

    private PointF PeriToScreen(double r, double th, double w)
    {
        double x = r * Math.Cos(th), y = r * Math.Sin(th);
        double cw = Math.Cos(w), sw = Math.Sin(w);
        float sx = (float)(x * cw - y * sw);
        float sy = (float)(x * sw + y * cw);
        return new PointF(cx + sx * pxScale, cy - sy * pxScale);
    }

    private double NodeTrueAnomaly(double ut, double a, double e, double epoch, double curNu)
    {
        double mu = 3.5316e12;
        try { mu = orbit?.Body.GravitationalParameter ?? mu; } catch { }
        double n = Math.Sqrt(mu / (a * a * a));
        double dt = ut - epoch;
        double curE = 2 * Math.Atan2(Math.Sqrt(1 - e) * Math.Sin(curNu / 2), Math.Sqrt(1 + e) * Math.Cos(curNu / 2));
        double curM = curE - e * Math.Sin(curE);
        double tarM = curM + n * dt;
        double tarE = tarM;
        for (int i = 0; i < 100; i++) { double d = (tarM - tarE + e * Math.Sin(tarE)) / (1 - e * Math.Cos(tarE)); tarE += d; if (Math.Abs(d) < 1e-12) break; }
        return 2 * Math.Atan2(Math.Sqrt(1 + e) * Math.Sin(tarE / 2), Math.Sqrt(1 - e) * Math.Cos(tarE / 2));
    }

    private void ComputeSoiBodies(int n)
    {
        soiBodies.Clear();
        encounterText = "";
        if (orbit == null || connection == null) return;

        try
        {
            var currentBody = orbit.Body;
            var sc = connection.SpaceCenter();

            foreach (var kv in sc.Bodies)
            {
                var body = kv.Value;
                if (body.Name == currentBody.Name) continue;

                try
                {
                    double soi = body.SphereOfInfluence;
                    if (soi <= 0) continue;

                    var bodyOrbit = body.Orbit;
                    if (bodyOrbit == null) continue;

                    var pos = body.Position(currentBody.ReferenceFrame);
                    float bx = (float)pos.Item1, by = (float)pos.Item2;
                    var spi = new PointF(cx + bx * pxScale, cy - by * pxScale);
                    float scrR = (float)(soi * pxScale);

                    bool encounter = false;
                    double closeDist = double.MaxValue;

                    var checkOrbit = postBurnOrbit ?? orbit;
                    if (checkOrbit != null)
                    {
                        for (int i = 0; i < n; i++)
                        {
                            double th = 2 * Math.PI * i / n;
                            double r = checkOrbit.SemiMajorAxis * (1 - checkOrbit.Eccentricity * checkOrbit.Eccentricity)
                                / (1 + checkOrbit.Eccentricity * Math.Cos(th));
                            if (r < 0) continue;
                            double ox = r * Math.Cos(th), oy = r * Math.Sin(th);
                            double cw = Math.Cos(checkOrbit.ArgumentOfPeriapsis), sw = Math.Sin(checkOrbit.ArgumentOfPeriapsis);
                            double wx = ox * cw - oy * sw, wy = ox * sw + oy * cw;
                            double dx = wx - pos.Item1, dy = wy - pos.Item2;
                            double dist = Math.Sqrt(dx * dx + dy * dy);
                            if (dist < closeDist) closeDist = dist;
                            if (dist < soi) encounter = true;
                        }
                    }

                    soiBodies.Add(new SoiBody
                    {
                        Name = body.Name,
                        ScreenPos = spi,
                        SoiRadius = (float)soi,
                        ScreenSoi = scrR,
                        Encounter = encounter && postBurnOrbit != null,
                        CloseApproach = closeDist
                    });
                }
                catch { }
            }

            foreach (var sb in soiBodies)
            {
                if (sb.Encounter) { encounterText = $"\u2192 {sb.Name} (CA: {FmtDist(sb.CloseApproach)})"; break; }
            }
        }
        catch { }
    }

    private static string FmtDist(double m) => m >= 1_000_000 ? $"{m / 1_000_000:N2} Mm" : m >= 1000 ? $"{m / 1000:N1} km" : $"{m:N0} m";

    private void UpdateMnuUI()
    {
        if (maneuverNode == null) { lblEnc.Text = ""; return; }
        uiUpdating = true;
        try
        {
            double dv = maneuverNode.DeltaV;
            lblDV.Text = $"{dv:N1} m/s";
            double isp = 300, mass = 0;
            try { isp = vessel!.SpecificImpulse; mass = vessel.Mass; } catch { }
            double bt = 0;
            try { double av = vessel!.AvailableThrust; if (av > 0) { double md = av / (isp * 9.82); double mf = mass * Math.Exp(-dv / (isp * 9.82)); bt = (mass - mf) / md; } } catch { }
            lblBurn.Text = bt > 0 ? $"{bt:N1} s" : "--";
            lblPro.Text = $"{maneuverNode.Prograde:N2}";
            lblNor.Text = $"{maneuverNode.Normal:N2}";
            lblRad.Text = $"{maneuverNode.Radial:N2}";
            if (nudPro.Value != (decimal)maneuverNode.Prograde) nudPro.Value = (decimal)Math.Round(maneuverNode.Prograde, 2);
            if (nudNor.Value != (decimal)maneuverNode.Normal) nudNor.Value = (decimal)Math.Round(maneuverNode.Normal, 2);
            if (nudRad.Value != (decimal)maneuverNode.Radial) nudRad.Value = (decimal)Math.Round(maneuverNode.Radial, 2);
            if (postBurnOrbit != null) { lblPePost.Text = FmtAlt(postBurnOrbit.PeriapsisAltitude); lblApPost.Text = FmtAlt(postBurnOrbit.ApoapsisAltitude); }
            double tOff = maneuverNode.UT - (orbit?.Epoch ?? 0);
            if ((decimal)tOff != nudTime.Value) nudTime.Value = (decimal)Math.Round(tOff, 1);
            lblEnc.Text = encounterText;
        }
        finally { uiUpdating = false; }
    }

    private void UpdateStatus()
    {
        if (orbit == null) return;
        double alt = 0, spd = 0;
        try { alt = flight?.MeanAltitude ?? 0; spd = flightSurface?.Speed ?? 0; } catch { }
        string m = maneuverNode != null ? $" | ΔV: {maneuverNode.DeltaV:N1} m/s | T: {FmtTime(timeToNode)}" : "";
        string soi = "";
        foreach (var sb in soiBodies) if (sb.Encounter) { soi = $" | SOI: {sb.Name}"; break; }
        lblStatusText.Text = $"Pe: {FmtAlt(orbit.PeriapsisAltitude)} | Ap: {FmtAlt(orbit.ApoapsisAltitude)} | Alt: {FmtAlt(alt)} | Vel: {spd:N1} m/s ({spd * 3.6:N1} km/h) | Period: {FmtTime(orbit.Period)}{m}{soi}";
    }

    private static string FmtAlt(double m) => m < 0 ? "---" : m >= 1_000_000 ? $"{m / 1_000_000:N2} Mm" : m >= 1000 ? $"{m / 1000:N1} km" : $"{m:N0} m";
    private static string FmtTime(double s) => s < 0 || double.IsNaN(s) || double.IsInfinity(s) ? "---" : s < 60 ? $"{s:N1}s" : s < 3600 ? $"{(int)(s / 60)}m {(int)(s % 60)}s" : $"{(int)(s / 3600)}h {(int)((s % 3600) / 60)}m";

    private void ManeuverNud_ValueChanged(object? sender, EventArgs e)
    {
        if (uiUpdating || maneuverNode == null) return;
        try { maneuverNode.Prograde = (float)nudPro.Value; maneuverNode.Normal = (float)nudNor.Value; maneuverNode.Radial = (float)nudRad.Value; } catch { }
    }

    private void NodeTime_ValueChanged(object? sender, EventArgs e)
    {
        if (uiUpdating || maneuverNode == null || orbit == null || vesselControl == null) return;
        try
        {
            double newUt = orbit.Epoch + (double)nudTime.Value;
            if (newUt <= orbit.Epoch) newUt = orbit.Epoch + 1;
            double p = maneuverNode.Prograde, n = maneuverNode.Normal, r = maneuverNode.Radial;
            maneuverNode.Remove();
            maneuverNode = vesselControl.AddNode(newUt, (float)p, (float)n, (float)r);
        }
        catch { }
    }

    private void BtnAddNode_Click(object? sender, EventArgs e)
    {
        if (!isConnected || vesselControl == null) return;
        try
        {
            RemoveNode();
            double ut = (orbit?.Epoch ?? 0) + Math.Max(60, (orbit?.Period ?? 600) * 0.25);
            maneuverNode = vesselControl.AddNode(ut, (float)nudPro.Value, (float)nudNor.Value, (float)nudRad.Value);
            lblMnuName.Text = $"Nó T+{FmtTime(ut - (orbit?.Epoch ?? 0))}";
        }
        catch { }
    }

    private void BtnAddAtPe_Click(object? sender, EventArgs e)
    {
        if (!isConnected || vesselControl == null || orbit == null) return;
        try { RemoveNode(); double ut = orbit.Epoch + orbit.TimeToPeriapsis; if (ut < orbit.Epoch) ut = orbit.Epoch + 60; maneuverNode = vesselControl.AddNode(ut, (float)nudPro.Value, (float)nudNor.Value, (float)nudRad.Value); lblMnuName.Text = $"Nó Pe T+{FmtTime(ut - orbit.Epoch)}"; } catch { }
    }

    private void BtnAddAtAp_Click(object? sender, EventArgs e)
    {
        if (!isConnected || vesselControl == null || orbit == null) return;
        try { RemoveNode(); double ut = orbit.Epoch + orbit.TimeToApoapsis; if (ut < orbit.Epoch) ut = orbit.Epoch + 60; maneuverNode = vesselControl.AddNode(ut, (float)nudPro.Value, (float)nudNor.Value, (float)nudRad.Value); lblMnuName.Text = $"Nó Ap T+{FmtTime(ut - orbit.Epoch)}"; } catch { }
    }

    private void BtnCircularize_Click(object? sender, EventArgs e)
    {
        if (!isConnected || vesselControl == null || orbit == null) return;
        try
        {
            RemoveNode();
            double a = orbit.SemiMajorAxis, ecc = orbit.Eccentricity;
            double mu = orbit.Body.GravitationalParameter;
            double rPe = a * (1 - ecc);
            double circV = Math.Sqrt(mu / rPe);
            double vPe = Math.Sqrt(mu * (2 / rPe - 1 / a));
            double dv = circV - vPe;
            double ut = orbit.Epoch + orbit.TimeToPeriapsis;
            if (ut < orbit.Epoch) ut = orbit.Epoch + 60;
            maneuverNode = vesselControl.AddNode(ut, (float)dv, 0, 0);
            lblMnuName.Text = $"Circularizar Pe T+{FmtTime(ut - orbit.Epoch)}";
        }
        catch { }
    }

    private void RemoveNode()
    {
        if (maneuverNode == null) return;
        try { maneuverNode.Remove(); } catch { }
        maneuverNode = null; postBurnOrbit = null;
        lblMnuName.Text = ""; lblDV.Text = "--"; lblBurn.Text = "--";
        lblPePost.Text = "--"; lblApPost.Text = "--"; lblEnc.Text = "";
        lblPro.Text = "0.00"; lblNor.Text = "0.00"; lblRad.Text = "0.00";
        uiUpdating = true;
        nudPro.Value = 0; nudNor.Value = 0; nudRad.Value = 0; nudTime.Value = 0;
        uiUpdating = false;
    }

    private void BtnRemoveNode_Click(object? sender, EventArgs e) => RemoveNode();

    private void OrbitMap_Paint(object? sender, PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        g.Clear(Color.FromArgb(10, 10, 20));
        if (!isConnected || orbit == null)
        {
            g.DrawString("Desconectado.\nConecte ao kRPC para visualizar a órbita.", new Font("Segoe UI", 14), Brushes.Gray, orbitMap.Width / 2f - 140, orbitMap.Height / 2f - 20);
            return;
        }
        if (orbitPts.Length == 0) return;
        cx = orbitMap.Width / 2f + panX; cy = orbitMap.Height / 2f + panY;

        DrawGrid(g);
        DrawTarget(g);
        DrawSoi(g);
        DrawOrbit(g, orbitPts, Color.White, 2);
        DrawPost(g);
        DrawPlanet(g);
        DrawAps(g);
        DrawShip(g);
        DrawNode(g);
        DrawNodeInfo(g);
        DrawSoiLabels(g);
    }

    private void DrawGrid(Graphics g)
    {
        using var p = new Pen(Color.FromArgb(25, 25, 45));
        float baseR = Math.Min(orbitMap.Width, orbitMap.Height) * 0.42f;
        for (float r = 0.2f; r <= 1.01f; r += 0.2f) { float rr = baseR * r * zoom; g.DrawEllipse(p, cx - rr, cy - rr, rr * 2, rr * 2); }
        float ax = baseR * zoom;
        g.DrawLine(p, cx - ax, cy, cx + ax, cy); g.DrawLine(p, cx, cy - ax, cx, cy + ax);
    }

    private static void DrawOrbit(Graphics g, PointF[] pts, Color c, float w)
    {
        if (pts.Length < 2) return;
        var valid = pts.Where(p => p.X > -50000 && p.Y > -50000).ToArray();
        if (valid.Length < 2) return;
        using var pen = new Pen(c, w);
        g.DrawLines(pen, valid);
    }

    private void DrawTarget(Graphics g)
    {
        if (targetPts.Length < 2) return;
        using var p = new Pen(Color.FromArgb(200, 200, 80), 1.5f);
        var valid = targetPts.Where(pt => pt.X > -50000 && pt.Y > -50000).ToArray();
        if (valid.Length >= 2) g.DrawLines(p, valid);
    }

    private void DrawSoi(Graphics g)
    {
        foreach (var sb in soiBodies)
        {
            if (sb.ScreenSoi < 5 || sb.ScreenSoi > 5000) continue;
            using var p = new Pen(Color.FromArgb(60, 120, 180), 1) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dot };
            g.DrawEllipse(p, sb.ScreenPos.X - sb.ScreenSoi, sb.ScreenPos.Y - sb.ScreenSoi, sb.ScreenSoi * 2, sb.ScreenSoi * 2);
            using var b = new SolidBrush(Color.FromArgb(100, 100, 180, 80));
            g.FillEllipse(b, sb.ScreenPos.X - 3, sb.ScreenPos.Y - 3, 6, 6);
        }
    }

    private void DrawSoiLabels(Graphics g)
    {
        foreach (var sb in soiBodies)
        {
            if (sb.ScreenSoi < 5) continue;
            Color c = sb.Encounter ? Color.Yellow : Color.FromArgb(150, 180, 220);
            using var br = new SolidBrush(c);
            g.DrawString(sb.Name, new Font("Segoe UI", 7), br, sb.ScreenPos.X + 5, sb.ScreenPos.Y - 8);
            if (sb.Encounter && postBurnOrbit != null)
                g.DrawString($"SOI \u2192 {sb.Name}", new Font("Segoe UI", 7, FontStyle.Bold), Brushes.Yellow, sb.ScreenPos.X + 5, sb.ScreenPos.Y + 4);
        }
    }

    private void DrawPost(Graphics g)
    {
        if (postPts.Length < 2) return;
        using var p = new Pen(Color.Cyan, 1.5f) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dash };
        var valid = postPts.Where(pt => pt.X > -50000 && pt.Y > -50000).ToArray();
        if (valid.Length >= 2) g.DrawLines(p, valid);
    }

    private void DrawPlanet(Graphics g)
    {
        float r = bodyR * pxScale;
        if (r < 5) r = 5;
        using var f = new SolidBrush(Color.FromArgb(40, 80, 40));
        g.FillEllipse(f, cx - r, cy - r, r * 2, r * 2);
        using var b = new Pen(Color.FromArgb(100, 200, 100), 2);
        g.DrawEllipse(b, cx - r, cy - r, r * 2, r * 2);
        g.DrawString(bodyName, new Font("Segoe UI", 8, FontStyle.Bold), Brushes.LightGreen, cx + r + 4, cy - 8);
    }

    private void DrawAps(Graphics g)
    {
        using var mp = new Pen(Color.White, 2);
        if (pePos.X > 0) { g.DrawEllipse(mp, pePos.X - 4, pePos.Y - 4, 8, 8); g.DrawString("Pe", new Font("Segoe UI", 8, FontStyle.Bold), Brushes.White, pePos.X + 6, pePos.Y - 6); }
        if (apPos.X > 0) { g.DrawEllipse(mp, apPos.X - 4, apPos.Y - 4, 8, 8); g.DrawString("Ap", new Font("Segoe UI", 8, FontStyle.Bold), Brushes.White, apPos.X + 6, apPos.Y - 6); }
        if (postPts.Length >= 2 && maneuverNode != null)
        {
            using var c = new Pen(Color.Cyan, 1);
            if (postPePos.X > 0) { g.DrawEllipse(c, postPePos.X - 3, postPePos.Y - 3, 6, 6); g.DrawString("Pe'", new Font("Segoe UI", 7, FontStyle.Bold), Brushes.Cyan, postPePos.X + 5, postPePos.Y - 5); }
            if (postApPos.X > 0) { g.DrawEllipse(c, postApPos.X - 3, postApPos.Y - 3, 6, 6); g.DrawString("Ap'", new Font("Segoe UI", 7, FontStyle.Bold), Brushes.Cyan, postApPos.X + 5, postApPos.Y - 5); }
        }
    }

    private void DrawShip(Graphics g)
    {
        float x = vesselPos.X, y = vesselPos.Y;
        if (x <= 0 || y <= 0) return;
        var pts = new[] { new PointF(x, y - 8), new PointF(x - 6, y + 5), new PointF(x + 6, y + 5) };
        using var f = new SolidBrush(Color.Lime); g.FillPolygon(f, pts);
        using var b = new Pen(Color.DarkGreen, 1); g.DrawPolygon(b, pts);
    }

    private void DrawNode(Graphics g)
    {
        if (maneuverNode == null) return;
        float x = nodePos.X, y = nodePos.Y;
        if (x <= 0 || y <= 0) return;
        var c = mouseOnNode ? Color.Orange : Color.FromArgb(50, 120, 200);
        var bc = mouseOnNode ? Color.Yellow : Color.Cyan;
        using var f = new SolidBrush(c); g.FillEllipse(f, x - 8, y - 8, 16, 16);
        using var b = new Pen(bc, 2); g.DrawEllipse(b, x - 8, y - 8, 16, 16);
        g.DrawString("ΔV", new Font("Segoe UI", 7, FontStyle.Bold), Brushes.White, x + 10, y - 6);
    }

    private void DrawNodeInfo(Graphics g)
    {
        if (maneuverNode == null) return;
        g.DrawString($"ΔV: {maneuverNode.DeltaV:N1} m/s\nT: {FmtTime(timeToNode)}", new Font("Segoe UI", 8), Brushes.Cyan, nodePos.X + 12, nodePos.Y + 10);
    }

    private void OrbitMap_MouseDown(object? sender, MouseEventArgs e)
    {
        if (!isConnected) return;
        if (maneuverNode != null)
        {
            float dx = e.X - nodePos.X, dy = e.Y - nodePos.Y;
            if (dx * dx + dy * dy < 400) { draggingNode = true; mouseOnNode = true; lastMouse = e.Location; return; }
        }
        if (e.Button == MouseButtons.Right || e.Button == MouseButtons.Middle) { panning = true; lastMouse = e.Location; }
    }

    private void OrbitMap_MouseMove(object? sender, MouseEventArgs e)
    {
        if (!isConnected) return;
        if (draggingNode && maneuverNode != null)
        {
            float dx = e.X - lastMouse.X, dy = e.Y - lastMouse.Y;
            float s = 1f / Math.Max(zoom, 0.1f);
            if (dx != 0) maneuverNode.Prograde += dx * s;
            if (dy != 0) maneuverNode.Radial += -dy * s;
            lastMouse = e.Location; return;
        }
        if (panning) { panX += e.X - lastMouse.X; panY += e.Y - lastMouse.Y; lastMouse = e.Location; orbitMap.Invalidate(); return; }
        if (maneuverNode != null)
        {
            float dx = e.X - nodePos.X, dy = e.Y - nodePos.Y;
            bool on = dx * dx + dy * dy < 400;
            if (on != mouseOnNode) { mouseOnNode = on; orbitMap.Invalidate(); }
        }
    }

    private void OrbitMap_MouseUp(object? sender, MouseEventArgs e) { if (draggingNode) { draggingNode = false; mouseOnNode = false; orbitMap.Invalidate(); } panning = false; }

    private void OrbitMap_MouseClick(object? sender, MouseEventArgs e)
    {
        if (!isConnected || draggingNode || panning) return;
        if (e.Button == MouseButtons.Right && maneuverNode != null)
        {
            float dx = e.X - nodePos.X, dy = e.Y - nodePos.Y;
            if (dx * dx + dy * dy < 400) { RemoveNode(); return; }
        }
    }

    private void OrbitMap_MouseWheel(object? sender, MouseEventArgs e)
    {
        if (!isConnected) return;
        float old = zoom; zoom *= e.Delta > 0 ? 1.15f : 0.87f; zoom = Math.Clamp(zoom, 0.05f, 100f);
        float mx = e.X - (orbitMap.Width / 2f + panX), my = e.Y - (orbitMap.Height / 2f + panY);
        panX -= mx * (1 - zoom / old); panY -= my * (1 - zoom / old);
        orbitMap.Invalidate();
    }

    protected override void OnFormClosing(FormClosingEventArgs e) { RemoveNode(); Disconnect(); base.OnFormClosing(e); }
}
